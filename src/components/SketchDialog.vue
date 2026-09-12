<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getStroke } from "perfect-freehand";
import ColorPalette from "./sketch/ColorPalette.vue";
import SketchToolbar from "./sketch/SketchToolbar.vue";
import StrokeSizeControl from "./sketch/StrokeSizeControl.vue";

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue", "download"]);

const dialog = ref(null);
const stage = ref(null);
const committedCanvas = ref(null);
const liveCanvas = ref(null);
const textInput = ref(null);
const activeTool = ref("pen");
const activeShape = ref("rectangle");
const strokeColor = ref("#ffffff");
const strokeSize = ref(19);
const commands = ref([]);
const undoStack = ref([]);
const redoStack = ref([]);
const selectedIndex = ref(-1);
const shapeMenuOpen = ref(false);
const textEditor = ref(null);
const textValue = ref("");
const pointerCursor = ref({ x: 0, y: 0, visible: false });
const statusMessage = ref("");
const selectionCursor = ref("default");

let committedContext;
let liveContext;
let stageSize = { width: 1, height: 1 };
let gesture = null;
let textTransform = null;
let resizeObserver;

const textEditorPadding = 6;
const textEditorMinWidth = 96;
const textEditorDefaultWidth = 240;
const textLineHeight = 1.25;
const textMinSize = 12;
const textMaxSize = 160;

const toolLabels = { select: "选择并移动", pen: "画笔", text: "文字", eraser: "橡皮擦" };

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);
const hasContent = computed(() => commands.value.length > 0);
const selectedCommand = computed(() => commands.value[selectedIndex.value] || null);
const canvasCursor = computed(() => {
  if (activeTool.value === "select") return selectionCursor.value;
  if (activeTool.value === "text") return "text";
  if (activeTool.value === "shape") return "crosshair";
  return "none";
});
const pointerCursorStyle = computed(() => ({
  width: `${Math.max(strokeSize.value, 6)}px`,
  height: `${Math.max(strokeSize.value, 6)}px`,
  backgroundColor: activeTool.value === "eraser" ? "#a8a8a8" : strokeColor.value,
  left: `${pointerCursor.value.x}px`,
  top: `${pointerCursor.value.y}px`,
  opacity: pointerCursor.value.visible && ["pen", "eraser"].includes(activeTool.value) ? 1 : 0,
}));
const textEditorStyle = computed(() => {
  if (!textEditor.value) return {};
  const command = commands.value[textEditor.value.index];
  if (!command) return {};
  const bounds = textEditorBounds(command);
  return {
    left: `${bounds.x}px`,
    top: `${bounds.y}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    color: command.color,
    fontSize: `${command.size}px`,
    lineHeight: textLineHeight,
  };
});

const clone = (value = commands.value) => JSON.parse(JSON.stringify(value));

function announce(message) {
  statusMessage.value = "";
  requestAnimationFrame(() => {
    statusMessage.value = message;
  });
}

function normalizePoint(point) {
  return {
    x: point.x / stageSize.width,
    y: point.y / stageSize.height,
    pressure: point.pressure ?? 0.5,
  };
}

function pixelPoint(point) {
  return {
    x: point.x * stageSize.width,
    y: point.y * stageSize.height,
    pressure: point.pressure ?? 0.5,
  };
}

function eventPoint(event) {
  const bounds = liveCanvas.value.getBoundingClientRect();
  const scaleX = liveCanvas.value.clientWidth / bounds.width;
  const scaleY = liveCanvas.value.clientHeight / bounds.height;
  return {
    x: (event.clientX - bounds.left) * scaleX,
    y: (event.clientY - bounds.top) * scaleY,
    pressure: event.pressure || 0.5,
  };
}

function strokePath(points) {
  if (!points.length) return "";
  const path = points.reduce(
    (result, point, index, list) => {
      const next = list[(index + 1) % list.length];
      result.push(point, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2]);
      return result;
    },
    ["M", points[0], "Q"],
  );
  path.push("Z");
  return path.flat().join(" ");
}

function prepareContext(context) {
  const dpr = window.devicePixelRatio || 1;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
}

function drawFreehand(context, command, preview = false) {
  const input = command.points.map((point) => {
    const pixel = pixelPoint(point);
    return [pixel.x, pixel.y, pixel.pressure];
  });
  const outline = getStroke(input, {
    size: command.size,
    thinning: command.usePressure ? 0.45 : 0,
    smoothing: 0.85,
    streamline: 0.28,
    simulatePressure: false,
    last: true,
  });
  if (!outline.length) return;

  context.save();
  context.globalCompositeOperation = command.type === "eraser" && !preview ? "destination-out" : "source-over";
  context.fillStyle = command.type === "eraser" && preview ? "rgba(168, 168, 168, 0.5)" : command.color;
  context.fill(new Path2D(strokePath(outline)));
  context.restore();
}

function drawShape(context, command) {
  const start = pixelPoint(command.start);
  const end = pixelPoint(command.end);
  const width = end.x - start.x;
  const height = end.y - start.y;
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  context.save();
  context.strokeStyle = command.color;
  context.lineWidth = command.size;
  context.beginPath();
  if (command.shape === "ellipse") {
    context.ellipse(
      start.x + width / 2,
      start.y + height / 2,
      Math.abs(width / 2),
      Math.abs(height / 2),
      0,
      0,
      Math.PI * 2,
    );
  } else if (command.shape === "line" || command.shape === "arrow") {
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    if (command.shape === "arrow") {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = Math.min(Math.hypot(width, height) * 0.35, Math.max(14, command.size * 2.2));
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
    }
  } else if (command.shape === "triangle") {
    context.moveTo(centerX, top);
    context.lineTo(right, bottom);
    context.lineTo(left, bottom);
    context.closePath();
  } else if (command.shape === "diamond") {
    context.moveTo(centerX, top);
    context.lineTo(right, centerY);
    context.lineTo(centerX, bottom);
    context.lineTo(left, centerY);
    context.closePath();
  } else if (command.shape === "star") {
    const radiusX = (right - left) / 2;
    const radiusY = (bottom - top) / 2;
    for (let index = 0; index < 10; index += 1) {
      const radiusScale = index % 2 === 0 ? 1 : 0.42;
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const x = centerX + Math.cos(angle) * radiusX * radiusScale;
      const y = centerY + Math.sin(angle) * radiusY * radiusScale;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  } else if (command.shape === "heart") {
    const shapeWidth = right - left;
    const shapeHeight = bottom - top;
    context.moveTo(centerX, bottom);
    context.bezierCurveTo(left, top + shapeHeight * 0.58, left, top, centerX, top + shapeHeight * 0.28);
    context.bezierCurveTo(right, top, right, top + shapeHeight * 0.58, centerX, bottom);
    context.closePath();
  } else {
    context.rect(start.x, start.y, width, height);
  }
  context.stroke();
  context.restore();
}

function drawCommand(context, command, preview = false) {
  if (["pen", "eraser"].includes(command.type)) {
    drawFreehand(context, command, preview);
    return;
  }
  if (command.type === "shape") {
    drawShape(context, command);
    return;
  }
  if (command.type === "text") {
    if (textEditor.value?.index === commands.value.indexOf(command)) return;
    const point = pixelPoint(command);
    const layout = textLayout(command);
    context.save();
    context.fillStyle = command.color;
    context.font = `600 ${command.size}px Inter, sans-serif`;
    context.textBaseline = "top";
    layout.lines.forEach((line, index) => {
      context.fillText(line, point.x, point.y + index * layout.lineHeight, layout.width);
    });
    context.restore();
  }
}

function measureTextWidth(command, text) {
  if (!committedContext) return Array.from(text).length * command.size * 0.6;
  committedContext.save();
  committedContext.font = `600 ${command.size}px Inter, sans-serif`;
  const width = committedContext.measureText(text).width;
  committedContext.restore();
  return width;
}

function wrapText(command, text, width) {
  const lines = [];
  text.split("\n").forEach((paragraph) => {
    if (!paragraph) {
      lines.push("");
      return;
    }
    let line = "";
    Array.from(paragraph).forEach((character) => {
      const candidate = line + character;
      if (line && measureTextWidth(command, candidate) > width) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    lines.push(line);
  });
  return lines.length ? lines : [""];
}

function textLayout(command, text = command.text) {
  const naturalWidth = Math.max(
    textEditorMinWidth,
    ...text.split("\n").map((line) => measureTextWidth(command, line || " ")),
  );
  const width = command.width
    ? Math.max(textEditorMinWidth, command.width * stageSize.width)
    : naturalWidth;
  const lines = command.width ? wrapText(command, text, width) : text.split("\n");
  const lineHeight = command.size * textLineHeight;
  return { width, height: Math.max(lineHeight, lines.length * lineHeight), lineHeight, lines };
}

function textEditorBounds(command) {
  const point = pixelPoint(command);
  const layout = textLayout(command, textValue.value);
  return {
    x: point.x - textEditorPadding,
    y: point.y - textEditorPadding,
    width: layout.width + textEditorPadding * 2,
    height: layout.height + textEditorPadding * 2,
  };
}

function commandBounds(command) {
  if (command.type === "text") {
    const point = pixelPoint(command);
    const layout = textLayout(command);
    return { x: point.x, y: point.y, width: layout.width, height: layout.height };
  }

  const normalizedPoints = command.type === "shape" ? [command.start, command.end] : command.points;
  const points = normalizedPoints.map(pixelPoint);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const padding = Math.max(command.size, 8);
  return {
    x: Math.min(...xs) - padding,
    y: Math.min(...ys) - padding,
    width: Math.max(...xs) - Math.min(...xs) + padding * 2,
    height: Math.max(...ys) - Math.min(...ys) + padding * 2,
  };
}

function geometryBounds(command) {
  if (command.type === "text") return commandBounds(command);
  if (command.type === "shape") {
    const start = pixelPoint(command.start);
    const end = pixelPoint(command.end);
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }
  if (command.type === "pen") {
    const points = command.points.map(pixelPoint);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }
  return commandBounds(command);
}

function selectionBounds(command) {
  const bounds = geometryBounds(command);
  const padding = ["shape", "pen"].includes(command.type) ? command.size / 2 + 1 : 0;
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function selectionHandles(command) {
  if (!["shape", "text", "pen"].includes(command.type)) return [];
  if (command.type === "shape" && ["line", "arrow"].includes(command.shape)) {
    return [
      { id: "start", ...pixelPoint(command.start) },
      { id: "end", ...pixelPoint(command.end) },
    ];
  }

  const bounds = selectionBounds(command);
  return [
    { id: "nw", x: bounds.x, y: bounds.y },
    { id: "n", x: bounds.x + bounds.width / 2, y: bounds.y },
    { id: "ne", x: bounds.x + bounds.width, y: bounds.y },
    { id: "e", x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
    { id: "se", x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { id: "s", x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
    { id: "sw", x: bounds.x, y: bounds.y + bounds.height },
    { id: "w", x: bounds.x, y: bounds.y + bounds.height / 2 },
  ];
}

function findResizeHandle(point, pointerType = "mouse") {
  const command = commands.value[selectedIndex.value];
  if (!command) return null;
  const hitRadius = pointerType === "touch" ? 22 : 12;
  return selectionHandles(command).find((handle) => Math.hypot(point.x - handle.x, point.y - handle.y) <= hitRadius) || null;
}

function resizeCursor(handle) {
  if (!handle) return "default";
  if (["nw", "se"].includes(handle.id)) return "nwse-resize";
  if (["ne", "sw"].includes(handle.id)) return "nesw-resize";
  if (["n", "s"].includes(handle.id)) return "ns-resize";
  if (["e", "w"].includes(handle.id)) return "ew-resize";
  return "crosshair";
}

function resizeBounds(bounds, handleId, point) {
  let left = bounds.x;
  let right = bounds.x + bounds.width;
  let top = bounds.y;
  let bottom = bounds.y + bounds.height;
  if (handleId.includes("w")) left = point.x;
  if (handleId.includes("e")) right = point.x;
  if (handleId.includes("n")) top = point.y;
  if (handleId.includes("s")) bottom = point.y;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function drawSelection() {
  const command = commands.value[selectedIndex.value];
  if (!command) return;
  const bounds = selectionBounds(command);
  liveContext.save();
  liveContext.strokeStyle = "#2c67c5";
  liveContext.lineWidth = 1.5;
  liveContext.setLineDash([5, 5]);
  if (!(command.type === "shape" && ["line", "arrow"].includes(command.shape))) {
    liveContext.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }
  liveContext.setLineDash([]);
  selectionHandles(command).forEach((handle) => {
    liveContext.fillStyle = "#ffffff";
    liveContext.strokeStyle = "#2c67c5";
    liveContext.lineWidth = 2;
    liveContext.beginPath();
    liveContext.rect(handle.x - 5, handle.y - 5, 10, 10);
    liveContext.fill();
    liveContext.stroke();
  });
  liveContext.restore();
}

function clearContext(context, canvas) {
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function render() {
  if (!committedContext || !liveContext || !committedCanvas.value || !liveCanvas.value) return;
  clearContext(committedContext, committedCanvas.value);
  clearContext(liveContext, liveCanvas.value);
  commands.value.forEach((command) => drawCommand(committedContext, command));
  if (!textEditor.value) drawSelection();
}

function renderLive(command) {
  clearContext(liveContext, liveCanvas.value);
  drawCommand(liveContext, command, true);
}

function renderEraserPreview(command) {
  clearContext(committedContext, committedCanvas.value);
  commands.value.forEach((savedCommand) => drawCommand(committedContext, savedCommand));
  drawCommand(committedContext, command);
  clearContext(liveContext, liveCanvas.value);
}

function resizeCanvases() {
  if (!stage.value) return;
  const width = stage.value.clientWidth;
  const height = stage.value.clientHeight;
  if (!width || !height) return;
  stageSize = { width, height };
  const dpr = window.devicePixelRatio || 1;
  [committedCanvas.value, liveCanvas.value].forEach((canvas) => {
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  });
  prepareContext(committedContext);
  prepareContext(liveContext);
  render();
}

function pushHistory(previous) {
  undoStack.value.push(previous);
  redoStack.value = [];
  render();
}

function selectTool(tool) {
  if (textEditor.value) commitText();
  activeTool.value = tool;
  selectedIndex.value = -1;
  selectionCursor.value = "default";
  shapeMenuOpen.value = false;
  render();
  announce(`${toolLabels[tool] || "形状"}已选择`);
}

function toggleShapeMenu() {
  if (textEditor.value) commitText();
  activeTool.value = "shape";
  selectedIndex.value = -1;
  shapeMenuOpen.value = !shapeMenuOpen.value;
  render();
}

function selectShape(shape) {
  activeShape.value = shape.id;
  activeTool.value = "shape";
  shapeMenuOpen.value = false;
  announce(`${shape.label}已选择`);
}

function selectCommand(index) {
  selectedIndex.value = index;
  const command = commands.value[index];
  if (command?.color) strokeColor.value = command.color;
}

function setStrokeColor(color) {
  if (!color || color === strokeColor.value && selectedCommand.value?.color === color) return;
  strokeColor.value = color;
  const command = selectedCommand.value;
  if (!command || command.type === "eraser" || command.color === color) return;
  const previous = clone();
  command.color = color;
  pushHistory(previous);
  announce("对象颜色已更新");
}

function findCommand(point) {
  for (let index = commands.value.length - 1; index >= 0; index -= 1) {
    if (commands.value[index].type === "eraser") continue;
    const bounds = commandBounds(commands.value[index]);
    if (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    ) return index;
  }
  return -1;
}

function translateCommand(command, dx, dy) {
  if (command.type === "text") {
    command.x += dx;
    command.y += dy;
  } else if (command.type === "shape") {
    command.start.x += dx;
    command.start.y += dy;
    command.end.x += dx;
    command.end.y += dy;
  } else {
    command.points.forEach((point) => {
      point.x += dx;
      point.y += dy;
    });
  }
}

function resizeTextCommand(command, point, state) {
  const handle = state.handle;
  const originalBounds = state.originalBounds;
  const targetBounds = resizeBounds(originalBounds, handle.id, point);
  const padding = state.draft ? textEditorPadding : 0;
  const horizontal = /[ew]/.test(handle.id);
  const vertical = /[ns]/.test(handle.id);

  if (horizontal) {
    const contentWidth = Math.max(textEditorMinWidth, Math.abs(targetBounds.width) - padding * 2);
    command.width = contentWidth / stageSize.width;
    const x = handle.id.includes("w")
      ? originalBounds.x + originalBounds.width - contentWidth - padding
      : originalBounds.x + padding;
    command.x = x / stageSize.width;
  }

  if (vertical) {
    const originalHeight = Math.max(originalBounds.height - padding * 2, 1);
    const targetHeight = Math.max(command.size * textLineHeight, Math.abs(targetBounds.height) - padding * 2);
    command.size = Math.round(Math.min(textMaxSize, Math.max(textMinSize, state.originalCommand.size * targetHeight / originalHeight)));
  }

  if (handle.id.includes("n")) {
    const height = textLayout(command, command.text).height;
    command.y = (originalBounds.y + originalBounds.height - height - padding) / stageSize.height;
  } else {
    command.y = (originalBounds.y + padding) / stageSize.height;
  }
}

function resizeCommand(command, point) {
  const handle = gesture.handle;
  const normalized = normalizePoint(point);

  if (command.type === "shape" && ["line", "arrow"].includes(command.shape)) {
    command[handle.id] = normalized;
    return;
  }

  if (command.type === "shape") {
    const padding = command.size / 2 + 1;
    const targetSelection = resizeBounds(gesture.originalSelectionBounds, handle.id, point);
    const left = Math.min(targetSelection.x, targetSelection.x + targetSelection.width) + padding;
    const right = Math.max(targetSelection.x, targetSelection.x + targetSelection.width) - padding;
    const top = Math.min(targetSelection.y, targetSelection.y + targetSelection.height) + padding;
    const bottom = Math.max(targetSelection.y, targetSelection.y + targetSelection.height) - padding;
    command.start = normalizePoint({ x: left, y: top });
    command.end = normalizePoint({ x: right, y: bottom });
    return;
  }

  if (command.type === "text") {
    resizeTextCommand(command, point, gesture);
    return;
  }

  if (command.type === "pen") {
    const originalBounds = gesture.originalBounds;
    const padding = command.size / 2 + 1;
    const targetSelection = resizeBounds(gesture.originalSelectionBounds, handle.id, point);
    const targetGeometry = {
      x: targetSelection.x + padding,
      y: targetSelection.y + padding,
      width: targetSelection.width - padding * 2,
      height: targetSelection.height - padding * 2,
    };
    const scaleX = targetGeometry.width / Math.max(originalBounds.width, 1);
    const scaleY = targetGeometry.height / Math.max(originalBounds.height, 1);

    command.points = gesture.originalCommand.points.map((originalPoint) => {
      const pixel = pixelPoint(originalPoint);
      return normalizePoint({
        x: targetGeometry.x + (pixel.x - originalBounds.x) * scaleX,
        y: targetGeometry.y + (pixel.y - originalBounds.y) * scaleY,
        pressure: originalPoint.pressure,
      });
    });
  }
}

function updatePointerCursor(point, visible = true) {
  pointerCursor.value = { x: point.x, y: point.y, visible };
}

function onCanvasLeave() {
  pointerCursor.value.visible = false;
  if (!gesture) selectionCursor.value = "default";
}

function startText(point) {
  const normalized = normalizePoint(point);
  const previous = clone();
  commands.value.push({
    type: "text",
    text: "",
    x: normalized.x,
    y: normalized.y,
    color: strokeColor.value,
    size: 32,
    width: Math.min(textEditorDefaultWidth, Math.max(textEditorMinWidth, stageSize.width - point.x - 24)) / stageSize.width,
  });
  beginTextEdit(commands.value.length - 1, previous, true);
}

function beginTextEdit(index, previous = clone(), isNew = false) {
  const command = commands.value[index];
  if (command?.type !== "text") return;
  if (!command.width) {
    command.width = Math.min(textEditorDefaultWidth, textLayout(command).width) / stageSize.width;
  }
  selectCommand(index);
  textEditor.value = { index, previous, isNew };
  textValue.value = command.text;
  render();
  nextTick(() => {
    textInput.value?.focus();
    textInput.value?.setSelectionRange(textValue.value.length, textValue.value.length);
  });
}

function commitText() {
  if (!textEditor.value) return;
  const editor = textEditor.value;
  const command = commands.value[editor.index];
  const text = textValue.value.replace(/\r/g, "").trimEnd();
  textEditor.value = null;
  if (!command) {
    selectedIndex.value = -1;
    render();
    return;
  }
  if (!text.trim()) {
    if (editor.isNew) {
      commands.value = editor.previous;
      selectedIndex.value = -1;
      render();
    } else {
      commands.value.splice(editor.index, 1);
      selectedIndex.value = -1;
      pushHistory(editor.previous);
      announce("文字已删除");
    }
    return;
  }
  command.text = text;
  activeTool.value = "select";
  selectedIndex.value = editor.index;
  selectionCursor.value = "move";
  if (JSON.stringify(editor.previous) !== JSON.stringify(commands.value)) {
    pushHistory(editor.previous);
    announce(editor.isNew ? "文字已添加" : "文字已更新");
  } else {
    render();
  }
}

function cancelText() {
  if (!textEditor.value) return;
  const editor = textEditor.value;
  commands.value = editor.previous;
  textEditor.value = null;
  textValue.value = "";
  selectedIndex.value = editor.isNew ? -1 : Math.min(editor.index, commands.value.length - 1);
  render();
  liveCanvas.value?.focus();
}

function startTextTransform(event, type, handleId = null) {
  const editor = textEditor.value;
  const command = commands.value[editor?.index];
  if (!command) return;
  const point = eventPoint(event);
  const handle = handleId ? { id: handleId } : null;
  const bounds = textEditorBounds(command);
  textTransform = {
    type,
    handle,
    start: normalizePoint(point),
    originalCommand: clone(command),
    originalBounds: bounds,
    draft: true,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function moveTextTransform(event) {
  if (!textTransform || !textEditor.value) return;
  const command = commands.value[textEditor.value.index];
  const point = eventPoint(event);
  if (textTransform.type === "move") {
    const normalized = normalizePoint(point);
    command.x = textTransform.originalCommand.x + normalized.x - textTransform.start.x;
    command.y = textTransform.originalCommand.y + normalized.y - textTransform.start.y;
  } else {
    resizeTextCommand(command, point, textTransform);
  }
}

function finishTextTransform(event) {
  if (!textTransform) return;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  textTransform = null;
  nextTick(() => textInput.value?.focus());
}

function onPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  shapeMenuOpen.value = false;
  const point = eventPoint(event);
  updatePointerCursor(point);

  if (activeTool.value === "text") {
    gesture = { type: "text", point };
    return;
  }

  if (activeTool.value === "select") {
    const resizeHandle = findResizeHandle(point, event.pointerType);
    if (resizeHandle) {
      const command = commands.value[selectedIndex.value];
      gesture = {
        type: "resize",
        handle: resizeHandle,
        previous: clone(),
        originalCommand: clone(command),
        originalBounds: ["shape", "pen"].includes(command.type) ? geometryBounds(command) : selectionBounds(command),
        originalSelectionBounds: selectionBounds(command),
        moved: false,
      };
      selectionCursor.value = resizeCursor(resizeHandle);
      liveCanvas.value.setPointerCapture(event.pointerId);
      return;
    }

    selectCommand(findCommand(point));
    gesture = selectedIndex.value >= 0
      ? { type: "move", last: normalizePoint(point), previous: clone(), moved: false }
      : null;
    selectionCursor.value = selectedIndex.value >= 0 ? "move" : "default";
    if (gesture) liveCanvas.value.setPointerCapture(event.pointerId);
    render();
    return;
  }

  liveCanvas.value.setPointerCapture(event.pointerId);
  const normalized = normalizePoint(point);
  gesture = {
    type: activeTool.value,
    previous: clone(),
    command: activeTool.value === "shape"
      ? {
          type: "shape",
          shape: activeShape.value,
          start: normalized,
          end: normalized,
          color: strokeColor.value,
          size: strokeSize.value,
        }
      : {
          type: activeTool.value,
          points: [normalized],
          color: strokeColor.value,
          size: strokeSize.value,
          usePressure: activeTool.value === "pen" && event.pointerType === "pen",
        },
  };
}

function onCanvasDoubleClick(event) {
  if (activeTool.value !== "select") return;
  const index = findCommand(eventPoint(event));
  if (commands.value[index]?.type !== "text") return;
  event.preventDefault();
  gesture = null;
  beginTextEdit(index);
}

function onPointerMove(event) {
  const point = eventPoint(event);
  updatePointerCursor(point);
  if (!gesture) {
    if (activeTool.value === "select") {
      const handle = findResizeHandle(point, event.pointerType);
      selectionCursor.value = handle ? resizeCursor(handle) : findCommand(point) >= 0 ? "move" : "default";
    }
    return;
  }

  if (gesture.type === "text") return;

  if (gesture.type === "move") {
    const normalized = normalizePoint(point);
    const dx = normalized.x - gesture.last.x;
    const dy = normalized.y - gesture.last.y;
    translateCommand(commands.value[selectedIndex.value], dx, dy);
    gesture.last = normalized;
    gesture.moved = true;
    render();
    return;
  }

  if (gesture.type === "resize") {
    resizeCommand(commands.value[selectedIndex.value], point);
    gesture.moved = true;
    render();
    return;
  }

  if (gesture.type === "shape") {
    gesture.command.end = normalizePoint(point);
  } else {
    const pointerEvents = event.getCoalescedEvents?.() || [event];
    pointerEvents.forEach((pointerEvent) => {
      gesture.command.points.push(normalizePoint(eventPoint(pointerEvent)));
    });
  }
  if (gesture.type === "eraser") renderEraserPreview(gesture.command);
  else renderLive(gesture.command);
}

function finishPointer(event, cancelled = false) {
  if (!gesture) return;
  if (liveCanvas.value.hasPointerCapture(event.pointerId)) {
    liveCanvas.value.releasePointerCapture(event.pointerId);
  }

  if (cancelled) {
    if (["move", "resize"].includes(gesture.type)) commands.value = gesture.previous;
    gesture = null;
    render();
    return;
  }

  if (gesture.type === "text") {
    const point = gesture.point;
    gesture = null;
    startText(point);
    return;
  }

  if (["move", "resize"].includes(gesture.type)) {
    if (gesture.moved) {
      pushHistory(gesture.previous);
      announce(gesture.type === "resize" ? "对象大小已调整" : "对象已移动");
    }
  } else {
    const command = gesture.command;
    if (["pen", "eraser"].includes(command.type)) {
      const endPoint = normalizePoint(eventPoint(event));
      const lastPoint = command.points.at(-1);
      if (Math.hypot(endPoint.x - lastPoint.x, endPoint.y - lastPoint.y) > 0.0001) {
        command.points.push(endPoint);
      }
    }
    const shapeStart = command.type === "shape" ? pixelPoint(command.start) : null;
    const shapeEnd = command.type === "shape" ? pixelPoint(command.end) : null;
    const shouldCommit = command.type !== "shape" || Math.hypot(shapeEnd.x - shapeStart.x, shapeEnd.y - shapeStart.y) > 3;
    if (shouldCommit) {
      commands.value.push(command);
      pushHistory(gesture.previous);
      if (command.type === "shape") {
        activeTool.value = "select";
        selectedIndex.value = commands.value.length - 1;
        selectionCursor.value = "move";
        render();
      }
      announce("内容已添加");
    } else {
      render();
    }
  }
  gesture = null;
}

function undo() {
  if (!canUndo.value) return;
  redoStack.value.push(clone());
  commands.value = undoStack.value.pop();
  selectedIndex.value = -1;
  render();
  announce("已撤销");
}

function redo() {
  if (!canRedo.value) return;
  undoStack.value.push(clone());
  commands.value = redoStack.value.pop();
  selectedIndex.value = -1;
  render();
  announce("已重做");
}

function clearCanvas() {
  if (!hasContent.value) return;
  const previous = clone();
  commands.value = [];
  selectedIndex.value = -1;
  pushHistory(previous);
  announce("画布已清空");
}

function downloadCanvas() {
  const output = document.createElement("canvas");
  output.width = committedCanvas.value.width;
  output.height = committedCanvas.value.height;
  const context = output.getContext("2d");
  context.fillStyle = "#212121";
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(committedCanvas.value, 0, 0);

  const link = document.createElement("a");
  link.download = `sketch-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = output.toDataURL("image/png");
  link.click();
  emit("download", link.download);
  announce("图片已下载");
}

function finishSketch() {
  if (!hasContent.value) return;
  downloadCanvas();
  closeDialog();
}

function closeDialog() {
  if (dialog.value?.open) dialog.value.close();
  emit("update:modelValue", false);
}

function onDialogClick(event) {
  if (event.target === dialog.value) closeDialog();
}

function onCancel(event) {
  event.preventDefault();
  closeDialog();
}

function onKeydown(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
    return;
  }
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  }
  if (event.key === "Escape" && selectedIndex.value >= 0) {
    selectedIndex.value = -1;
    selectionCursor.value = "default";
    render();
    return;
  }
  if (event.key === "Enter" && selectedCommand.value?.type === "text") {
    event.preventDefault();
    beginTextEdit(selectedIndex.value);
    return;
  }
  if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key) && selectedIndex.value >= 0) {
    event.preventDefault();
    const previous = clone();
    const distance = event.shiftKey ? 10 : 1;
    const offsets = {
      ArrowUp: [0, -distance / stageSize.height],
      ArrowRight: [distance / stageSize.width, 0],
      ArrowDown: [0, distance / stageSize.height],
      ArrowLeft: [-distance / stageSize.width, 0],
    };
    translateCommand(selectedCommand.value, ...offsets[event.key]);
    pushHistory(previous);
    return;
  }
  if (["Backspace", "Delete"].includes(event.key) && selectedIndex.value >= 0) {
    event.preventDefault();
    const previous = clone();
    commands.value.splice(selectedIndex.value, 1);
    selectedIndex.value = -1;
    pushHistory(previous);
    announce("对象已删除");
  }
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    await nextTick();
    if (!dialog.value) return;
    if (isOpen && !dialog.value.open) {
      dialog.value.showModal();
      await nextTick();
      resizeCanvases();
      liveCanvas.value.focus();
    } else if (!isOpen && dialog.value.open) {
      dialog.value.close();
    }
  },
);

watch(strokeSize, (size) => announce(`画笔粗细 ${size} 像素`));
watch(textValue, (value) => {
  if (!textEditor.value) return;
  const command = commands.value[textEditor.value.index];
  if (command) command.text = value;
});

onMounted(() => {
  committedContext = committedCanvas.value.getContext("2d");
  liveContext = liveCanvas.value.getContext("2d");
  resizeObserver = new ResizeObserver(() => {
    if (dialog.value?.open) resizeCanvases();
  });
  resizeObserver.observe(stage.value);
  if (props.modelValue) {
    dialog.value.showModal();
    nextTick(() => {
      resizeCanvases();
      liveCanvas.value.focus();
    });
  }
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="sketch-dialog"
      aria-labelledby="sketch-dialog-title"
      @cancel="onCancel"
      @click="onDialogClick"
      @keydown="onKeydown"
    >
      <section class="sketch-editor">
        <h2 id="sketch-dialog-title" class="sr-only">画板</h2>

        <SketchToolbar
          :active-tool="activeTool"
          :active-shape="activeShape"
          :shape-menu-open="shapeMenuOpen"
          :can-undo="canUndo"
          :can-redo="canRedo"
          :has-content="hasContent"
          @close="closeDialog"
          @select-tool="selectTool"
          @toggle-shapes="toggleShapeMenu"
          @select-shape="selectShape"
          @undo="undo"
          @redo="redo"
          @clear="clearCanvas"
        />

        <div ref="stage" class="sketch-stage">
          <canvas ref="committedCanvas" class="committed-canvas" aria-hidden="true"></canvas>
          <canvas
            ref="liveCanvas"
            class="live-canvas"
            role="application"
            aria-label="画板，可使用鼠标、触控笔或触摸绘制"
            tabindex="0"
            :style="{ cursor: canvasCursor }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="finishPointer"
            @pointercancel="(event) => finishPointer(event, true)"
            @pointerenter="updatePointerCursor(eventPoint($event))"
            @pointerleave="onCanvasLeave"
            @dblclick="onCanvasDoubleClick"
          ></canvas>

          <span class="brush-cursor" :style="pointerCursorStyle" aria-hidden="true"></span>

          <div
            v-if="textEditor"
            class="canvas-text-editor"
            :style="textEditorStyle"
            title="拖动边框移动文字"
            @pointerdown.self.prevent.stop="startTextTransform($event, 'move')"
            @pointermove.prevent="moveTextTransform"
            @pointerup.prevent="finishTextTransform"
            @pointercancel.prevent="finishTextTransform"
          >
            <textarea
              ref="textInput"
              v-model="textValue"
              class="canvas-text-input"
              maxlength="500"
              aria-label="输入画布文字"
              spellcheck="false"
              @pointerdown.stop
              @keydown.meta.enter.prevent="$event.currentTarget.blur()"
              @keydown.ctrl.enter.prevent="$event.currentTarget.blur()"
              @keydown.esc.stop.prevent="cancelText"
              @blur="commitText"
            ></textarea>
            <button
              v-for="handle in ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']"
              :key="handle"
              class="text-resize-handle"
              :class="`is-${handle}`"
              type="button"
              tabindex="-1"
              :aria-label="`缩放文字 ${handle}`"
              @pointerdown.prevent.stop="startTextTransform($event, 'resize', handle)"
              @pointermove.prevent="moveTextTransform"
              @pointerup.prevent="finishTextTransform"
              @pointercancel.prevent="finishTextTransform"
            ></button>
          </div>

          <StrokeSizeControl v-model="strokeSize" />
          <ColorPalette :model-value="strokeColor" :disabled="!hasContent" @update:model-value="setStrokeColor" @finish="finishSketch" />

          <div class="sr-only" aria-live="polite">{{ statusMessage }}</div>
        </div>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.sketch-dialog {
  width: min(760px, calc(100vw - 32px));
  height: min(760px, calc(100dvh - 32px));
  max-width: none;
  max-height: none;
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: var(--sketch-radius-md);
  background: var(--sketch-color-surface);
  color: var(--sketch-color-text);
  box-shadow: var(--sketch-shadow-dialog);
}

.sketch-dialog::backdrop {
  background: var(--sketch-color-backdrop);
  backdrop-filter: blur(3px);
}

.sketch-dialog[open] {
  animation: dialog-in 220ms ease-out;
}

.sketch-editor,
.sketch-stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.sketch-editor {
  overflow: hidden;
  border-radius: inherit;
}

.sketch-stage {
  background: var(--sketch-color-surface);
  touch-action: none;
  user-select: none;
}

.sketch-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.committed-canvas {
  z-index: var(--sketch-z-canvas);
}

.live-canvas {
  z-index: calc(var(--sketch-z-canvas) + 1);
  outline: none;
}

.canvas-text-input:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

.brush-cursor {
  position: absolute;
  z-index: calc(var(--sketch-z-controls) - 1);
  border: 1px solid rgba(0, 0, 0);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(255, 255, 255);
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 80ms ease;
}

.canvas-text-editor {
  position: absolute;
  z-index: var(--sketch-z-popover);
  padding: 6px;
  border: 1.5px dashed #2c67c5;
  background: transparent;
  cursor: move;
  user-select: none;
}

.canvas-text-input {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font-family: Inter, sans-serif;
  font-size: inherit;
  font-weight: 600;
  line-height: 1.25;
  cursor: text;
  resize: none;
  user-select: text;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.canvas-text-input:focus-visible {
  outline: 0;
}

.text-resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  padding: 0;
  border: 2px solid #2c67c5;
  background: #ffffff;
}

.text-resize-handle.is-nw {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.text-resize-handle.is-ne {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.text-resize-handle.is-n {
  top: -6px;
  left: 50%;
  cursor: ns-resize;
  transform: translateX(-50%);
}

.text-resize-handle.is-e {
  top: 50%;
  right: -6px;
  cursor: ew-resize;
  transform: translateY(-50%);
}

.text-resize-handle.is-se {
  right: -6px;
  bottom: -6px;
  cursor: nwse-resize;
}

.text-resize-handle.is-sw {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.text-resize-handle.is-s {
  bottom: -6px;
  left: 50%;
  cursor: ns-resize;
  transform: translateX(-50%);
}

.text-resize-handle.is-w {
  top: 50%;
  left: -6px;
  cursor: ew-resize;
  transform: translateY(-50%);
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 640px) {
  .sketch-dialog {
    width: calc(100vw - 16px);
    height: calc(100dvh - 16px);
  }
}
</style>
