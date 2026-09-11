<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ArrowUpRight,
  Check,
  Circle,
  Diamond,
  Eraser,
  Heart,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Shapes,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  Undo2,
  X,
} from "@lucide/vue";
import { getStroke } from "perfect-freehand";

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
const sliderDragging = ref(false);
const selectionCursor = ref("default");

let committedContext;
let liveContext;
let stageSize = { width: 1, height: 1 };
let gesture = null;
let resizeObserver;

const strokeSizeMin = 2;
const strokeSizeMax = 36;
const sliderTrackLength = 192;

const tools = [
  { id: "select", label: "选择并移动", icon: MousePointer2 },
  { id: "pen", label: "画笔", icon: Pencil },
  { id: "text", label: "文字", icon: Type },
  { id: "eraser", label: "橡皮擦", icon: Eraser },
];

const shapes = [
  { id: "line", label: "直线", icon: Minus },
  { id: "arrow", label: "箭头", icon: ArrowUpRight },
  { id: "rectangle", label: "矩形", icon: Square },
  { id: "ellipse", label: "椭圆", icon: Circle },
  { id: "triangle", label: "三角形", icon: Triangle },
  { id: "diamond", label: "菱形", icon: Diamond },
  { id: "star", label: "星形", icon: Star },
  { id: "heart", label: "心形", icon: Heart },
];

const paletteColors = [
  { name: "白色", value: "#ffffff" },
  { name: "灰色", value: "#6b7280" },
  { name: "棕色", value: "#92400e" },
  { name: "红色", value: "#dc2626" },
  { name: "橙色", value: "#f97316" },
  { name: "黄色", value: "#f59e0b" },
  { name: "绿色", value: "#16a34a" },
  { name: "蓝绿色", value: "#0d9488" },
  { name: "青色", value: "#06b6d4" },
  { name: "蓝色", value: "#2563eb" },
  { name: "靛蓝色", value: "#4f46e5" },
  { name: "紫色", value: "#9333ea" },
  { name: "粉色", value: "#db2777" },
];

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);
const hasContent = computed(() => commands.value.length > 0);
const isCustomColor = computed(() => !paletteColors.some((color) => color.value === strokeColor.value.toLowerCase()));
const sliderThumbStyle = computed(() => {
  const ratio = (strokeSize.value - strokeSizeMin) / (strokeSizeMax - strokeSizeMin);
  return {
    top: `${(1 - ratio) * sliderTrackLength}px`,
    "--slider-percent": `${ratio * 100}%`,
  };
});
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
  return {
    left: `${Math.min(textEditor.value.x, stageSize.width - 164)}px`,
    top: `${Math.min(textEditor.value.y, stageSize.height - 52)}px`,
    color: strokeColor.value,
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
    const point = pixelPoint(command);
    context.save();
    context.fillStyle = command.color;
    context.font = `600 ${command.size}px Inter, sans-serif`;
    context.textBaseline = "top";
    context.fillText(command.text, point.x, point.y);
    context.restore();
  }
}

function commandBounds(command) {
  if (command.type === "text") {
    const point = pixelPoint(command);
    committedContext.save();
    committedContext.font = `600 ${command.size}px Inter, sans-serif`;
    const width = committedContext.measureText(command.text).width;
    committedContext.restore();
    return { x: point.x, y: point.y, width, height: command.size * 1.25 };
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
    { id: "ne", x: bounds.x + bounds.width, y: bounds.y },
    { id: "se", x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { id: "sw", x: bounds.x, y: bounds.y + bounds.height },
  ];
}

function findResizeHandle(point) {
  const command = commands.value[selectedIndex.value];
  if (!command) return null;
  return selectionHandles(command).find((handle) => Math.hypot(point.x - handle.x, point.y - handle.y) <= 10) || null;
}

function resizeCursor(handle) {
  if (!handle) return "default";
  if (["nw", "se"].includes(handle.id)) return "nwse-resize";
  if (["ne", "sw"].includes(handle.id)) return "nesw-resize";
  return "crosshair";
}

function oppositeHandlePoint(command, handle) {
  if (["start", "end"].includes(handle.id)) return null;
  const bounds = ["shape", "pen"].includes(command.type) ? geometryBounds(command) : selectionBounds(command);
  const points = {
    nw: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ne: { x: bounds.x, y: bounds.y + bounds.height },
    se: { x: bounds.x, y: bounds.y },
    sw: { x: bounds.x + bounds.width, y: bounds.y },
  };
  return normalizePoint(points[handle.id]);
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
    liveContext.rect(handle.x - 4, handle.y - 4, 8, 8);
    liveContext.fill();
    liveContext.stroke();
  });
  liveContext.restore();
}

function clearContext(context, canvas) {
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function render() {
  if (!committedContext || !liveContext) return;
  clearContext(committedContext, committedCanvas.value);
  clearContext(liveContext, liveCanvas.value);
  commands.value.forEach((command) => drawCommand(committedContext, command));
  drawSelection();
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
  activeTool.value = tool;
  selectedIndex.value = -1;
  selectionCursor.value = "default";
  shapeMenuOpen.value = false;
  render();
  announce(`${tools.find((item) => item.id === tool)?.label || "形状"}已选择`);
}

function toggleShapeMenu() {
  activeTool.value = "shape";
  selectedIndex.value = -1;
  shapeMenuOpen.value = !shapeMenuOpen.value;
  render();
}

function selectShape(shape) {
  activeShape.value = shape;
  activeTool.value = "shape";
  shapeMenuOpen.value = false;
  announce(`${shapes.find((item) => item.id === shape)?.label}已选择`);
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

function resizeCommand(command, point) {
  const handle = gesture.handle;
  const normalized = normalizePoint(point);

  if (command.type === "shape" && ["line", "arrow"].includes(command.shape)) {
    command[handle.id] = normalized;
    return;
  }

  if (command.type === "shape") {
    const padding = command.size / 2 + 1;
    const geometryPoint = normalizePoint({
      x: point.x + (["nw", "sw"].includes(handle.id) ? padding : -padding),
      y: point.y + (["nw", "ne"].includes(handle.id) ? padding : -padding),
    });
    const fixed = gesture.fixed;
    const corners = {
      nw: { start: geometryPoint, end: fixed },
      ne: { start: { x: fixed.x, y: geometryPoint.y }, end: { x: geometryPoint.x, y: fixed.y } },
      se: { start: fixed, end: geometryPoint },
      sw: { start: { x: geometryPoint.x, y: fixed.y }, end: { x: fixed.x, y: geometryPoint.y } },
    };
    command.start = corners[handle.id].start;
    command.end = corners[handle.id].end;
    return;
  }

  if (command.type === "text") {
    const fixed = pixelPoint(gesture.fixed);
    const originalBounds = gesture.originalBounds;
    const widthRatio = Math.abs(point.x - fixed.x) / Math.max(originalBounds.width, 1);
    const heightRatio = Math.abs(point.y - fixed.y) / Math.max(originalBounds.height, 1);
    const scale = Math.max(widthRatio, heightRatio);
    command.size = Math.round(Math.min(160, Math.max(12, gesture.originalCommand.size * scale)));

    committedContext.save();
    committedContext.font = `600 ${command.size}px Inter, sans-serif`;
    const width = committedContext.measureText(command.text).width;
    committedContext.restore();
    const height = command.size * 1.25;
    const positions = {
      nw: { x: fixed.x - width, y: fixed.y - height },
      ne: { x: fixed.x, y: fixed.y - height },
      se: { x: fixed.x, y: fixed.y },
      sw: { x: fixed.x - width, y: fixed.y },
    };
    command.x = positions[handle.id].x / stageSize.width;
    command.y = positions[handle.id].y / stageSize.height;
    return;
  }

  if (command.type === "pen") {
    const fixed = pixelPoint(gesture.fixed);
    const originalBounds = gesture.originalBounds;
    const padding = command.size / 2 + 1;
    const geometryPoint = {
      x: point.x + (["nw", "sw"].includes(handle.id) ? padding : -padding),
      y: point.y + (["nw", "ne"].includes(handle.id) ? padding : -padding),
    };
    const horizontal = ["nw", "sw"].includes(handle.id)
      ? { left: geometryPoint.x, right: fixed.x }
      : { left: fixed.x, right: geometryPoint.x };
    const vertical = ["nw", "ne"].includes(handle.id)
      ? { top: geometryPoint.y, bottom: fixed.y }
      : { top: fixed.y, bottom: geometryPoint.y };
    const scaleX = (horizontal.right - horizontal.left) / Math.max(originalBounds.width, 1);
    const scaleY = (vertical.bottom - vertical.top) / Math.max(originalBounds.height, 1);

    command.points = gesture.originalCommand.points.map((originalPoint) => {
      const pixel = pixelPoint(originalPoint);
      return normalizePoint({
        x: horizontal.left + (pixel.x - originalBounds.x) * scaleX,
        y: vertical.top + (pixel.y - originalBounds.y) * scaleY,
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

function updateStrokeSize(event, element) {
  const bounds = element.getBoundingClientRect();
  const horizontal = bounds.width > bounds.height;
  const trackStart = (horizontal ? bounds.left : bounds.top) + 16;
  const trackLength = (horizontal ? bounds.width : bounds.height) - 32;
  const pointerPosition = horizontal ? event.clientX : event.clientY;
  const position = Math.min(trackLength, Math.max(0, pointerPosition - trackStart));
  const ratio = horizontal ? position / trackLength : 1 - position / trackLength;
  strokeSize.value = Math.round(strokeSizeMin + ratio * (strokeSizeMax - strokeSizeMin));
}

function startSizeDrag(event) {
  sliderDragging.value = true;
  event.currentTarget.setPointerCapture(event.pointerId);
  updateStrokeSize(event, event.currentTarget);
}

function moveSizeDrag(event) {
  if (!sliderDragging.value) return;
  updateStrokeSize(event, event.currentTarget);
}

function finishSizeDrag(event) {
  if (!sliderDragging.value) return;
  sliderDragging.value = false;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function onSizeKeydown(event) {
  const steps = {
    ArrowUp: 1,
    ArrowRight: 1,
    ArrowDown: -1,
    ArrowLeft: -1,
    PageUp: 4,
    PageDown: -4,
  };
  if (event.key === "Home") {
    event.preventDefault();
    strokeSize.value = strokeSizeMin;
  } else if (event.key === "End") {
    event.preventDefault();
    strokeSize.value = strokeSizeMax;
  } else if (steps[event.key]) {
    event.preventDefault();
    strokeSize.value = Math.min(strokeSizeMax, Math.max(strokeSizeMin, strokeSize.value + steps[event.key]));
  }
}

function startText(point) {
  textEditor.value = point;
  textValue.value = "";
  nextTick(() => textInput.value?.focus());
}

function commitText() {
  if (!textEditor.value) return;
  const text = textValue.value.trim();
  const point = normalizePoint(textEditor.value);
  textEditor.value = null;
  if (!text) return;
  const previous = clone();
  commands.value.push({
    type: "text",
    text,
    x: point.x,
    y: point.y,
    color: strokeColor.value,
    size: Math.max(18, strokeSize.value * 3),
  });
  pushHistory(previous);
  activeTool.value = "select";
  selectedIndex.value = commands.value.length - 1;
  selectionCursor.value = "move";
  render();
  announce("文字已添加");
}

function cancelText() {
  textEditor.value = null;
  textValue.value = "";
  liveCanvas.value?.focus();
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
    const resizeHandle = findResizeHandle(point);
    if (resizeHandle) {
      const command = commands.value[selectedIndex.value];
      gesture = {
        type: "resize",
        handle: resizeHandle,
        fixed: oppositeHandlePoint(command, resizeHandle),
        previous: clone(),
        originalCommand: clone(command),
        originalBounds: ["shape", "pen"].includes(command.type) ? geometryBounds(command) : selectionBounds(command),
        moved: false,
      };
      selectionCursor.value = resizeCursor(resizeHandle);
      liveCanvas.value.setPointerCapture(event.pointerId);
      return;
    }

    selectedIndex.value = findCommand(point);
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

function onPointerMove(event) {
  const point = eventPoint(event);
  updatePointerCursor(point);
  if (!gesture) {
    if (activeTool.value === "select") {
      const handle = findResizeHandle(point);
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
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
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

        <header class="editor-header">
          <button class="icon-button close-button" type="button" title="关闭" aria-label="关闭画板" @click="closeDialog">
            <X :size="21" aria-hidden="true" />
          </button>

          <div class="tool-group" role="toolbar" aria-label="绘图工具">
            <button
              v-for="tool in tools.slice(0, 3)"
              :key="tool.id"
              class="tool-button"
              :class="{ 'is-active': activeTool === tool.id }"
              type="button"
              :title="tool.label"
              :aria-label="tool.label"
              :aria-pressed="activeTool === tool.id"
              @click="selectTool(tool.id)"
            >
              <component :is="tool.icon" :size="20" aria-hidden="true" />
            </button>

            <div class="shape-picker">
              <button
                class="tool-button"
                :class="{ 'is-active': activeTool === 'shape' }"
                type="button"
                title="形状"
                aria-label="选择形状"
                aria-haspopup="menu"
                :aria-expanded="shapeMenuOpen"
                @click="toggleShapeMenu"
              >
                <Shapes :size="20" aria-hidden="true" />
              </button>
              <div v-if="shapeMenuOpen" class="shape-menu" role="menu">
                <button
                  v-for="shape in shapes"
                  :key="shape.id"
                  class="shape-option"
                  :class="{ 'is-active': activeShape === shape.id }"
                  type="button"
                  role="menuitemradio"
                  :title="shape.label"
                  :aria-label="shape.label"
                  :aria-checked="activeShape === shape.id"
                  @click="selectShape(shape.id)"
                >
                  <component :is="shape.icon" :size="18" aria-hidden="true" />
                </button>
              </div>
            </div>

            <button
              class="tool-button"
              :class="{ 'is-active': activeTool === 'eraser' }"
              type="button"
              title="橡皮擦"
              aria-label="橡皮擦"
              :aria-pressed="activeTool === 'eraser'"
              @click="selectTool('eraser')"
            >
              <Eraser :size="20" aria-hidden="true" />
            </button>
          </div>

          <div class="action-group" role="group" aria-label="历史">
            <button class="icon-button" type="button" title="撤销 (Command/Ctrl+Z)" aria-label="撤销" :disabled="!canUndo" @click="undo">
              <Undo2 :size="20" aria-hidden="true" />
            </button>
            <button class="icon-button" type="button" title="重做 (Command/Ctrl+Shift+Z)" aria-label="重做" :disabled="!canRedo" @click="redo">
              <Redo2 :size="20" aria-hidden="true" />
            </button>
            <button class="icon-button" type="button" title="清空画布" aria-label="清空画布" :disabled="!hasContent" @click="clearCanvas">
              <Trash2 :size="19" aria-hidden="true" />
            </button>
          </div>
        </header>

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
          ></canvas>

          <span class="brush-cursor" :style="pointerCursorStyle" aria-hidden="true"></span>

          <input
            v-if="textEditor"
            ref="textInput"
            v-model="textValue"
            class="canvas-text-input"
            type="text"
            maxlength="80"
            aria-label="输入画布文字"
            :style="textEditorStyle"
            @keydown.enter.prevent="commitText"
            @keydown.esc.stop.prevent="cancelText"
            @blur="commitText"
          />

          <aside class="brush-controls" aria-label="画笔设置">
            <div
              class="size-control"
              :class="{ 'is-dragging': sliderDragging }"
              role="slider"
              tabindex="0"
              title="画笔粗细"
              aria-label="画笔粗细"
              aria-orientation="vertical"
              :aria-valuemin="strokeSizeMin"
              :aria-valuemax="strokeSizeMax"
              :aria-valuenow="strokeSize"
              :aria-valuetext="`${strokeSize} 像素`"
              @pointerdown.prevent="startSizeDrag"
              @pointermove.prevent="moveSizeDrag"
              @pointerup.prevent="finishSizeDrag"
              @pointercancel.prevent="finishSizeDrag"
              @keydown="onSizeKeydown"
            >
              <span class="size-control__track" aria-hidden="true"></span>
              <span class="size-control__scale" aria-hidden="true"></span>
              <span class="size-control__thumb" :style="sliderThumbStyle" aria-hidden="true"></span>
            </div>
          </aside>

          <div class="bottom-controls">
            <fieldset class="color-palette" aria-label="墨水颜色">
              <legend class="sr-only">墨水颜色</legend>
              <label
                class="color-button custom-color"
                :class="{ 'is-selected': isCustomColor }"
                title="选择自定义颜色"
                aria-label="选择自定义颜色"
              >
                <input v-model="strokeColor" type="color" />
              </label>
              <button
                v-for="color in paletteColors"
                :key="color.value"
                class="color-button"
                :class="{ 'is-selected': strokeColor.toLowerCase() === color.value }"
                type="button"
                :title="color.name"
                :aria-label="`使用${color.name}`"
                :aria-pressed="strokeColor.toLowerCase() === color.value"
                :style="{ backgroundColor: color.value }"
                @click="strokeColor = color.value"
              ></button>
            </fieldset>

            <button
              class="finish-button"
              type="button"
              title="完成并下载 PNG"
              aria-label="完成并下载 PNG"
              :disabled="!hasContent"
              @click="finishSketch"
            >
              <Check :size="20" aria-hidden="true" />
            </button>
          </div>

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

.editor-header {
  position: absolute;
  z-index: var(--sketch-z-controls);
  top: var(--sketch-space-3);
  right: var(--sketch-space-3);
  left: var(--sketch-space-3);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  pointer-events: none;
}

.editor-header button,
.shape-picker,
.action-group {
  pointer-events: auto;
}

.tool-group,
.action-group {
  display: flex;
  align-items: center;
}

.tool-group {
  gap: 2px;
  padding: var(--sketch-space-1);
  border: 1px solid var(--sketch-color-border);
  border-radius: var(--sketch-radius-pill);
  background: var(--sketch-color-control);
  box-shadow: var(--sketch-shadow-popover);
}

.action-group {
  justify-self: end;
  gap: var(--sketch-space-2);
}

.icon-button,
.tool-button {
  display: grid;
  width: var(--sketch-control-size);
  height: var(--sketch-control-size);
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sketch-color-text-muted);
  cursor: pointer;
  transition: color var(--sketch-transition-fast), background-color var(--sketch-transition-fast), opacity var(--sketch-transition-fast);
}

.icon-button:hover:not(:disabled),
.tool-button:hover,
.tool-button.is-active:hover {
  background: var(--sketch-color-control-hover);
  color: var(--sketch-color-text);
}

.tool-button.is-active {
  background: var(--sketch-color-control-active);
  color: var(--sketch-color-text);
}

.icon-button:disabled {
  opacity: 0.3;
  cursor: default;
}

.icon-button:focus-visible,
.tool-button:focus-visible,
.shape-menu button:focus-visible,
.canvas-text-input:focus-visible,
.color-button:has(input:focus-visible) {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

.shape-picker {
  position: relative;
}

.shape-menu {
  position: absolute;
  z-index: var(--sketch-z-popover);
  top: calc(100% + 8px);
  left: 50%;
  display: grid;
  width: 160px;
  grid-template-columns: repeat(4, 32px);
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--sketch-color-border);
  border-radius: 20px;
  background: var(--sketch-color-surface-raised);
  box-shadow: var(--sketch-shadow-popover);
  transform: translateX(-50%);
}

.shape-menu button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sketch-color-text);
  cursor: pointer;
  transition: color var(--sketch-transition-fast), background-color var(--sketch-transition-fast);
}

.shape-menu button:hover,
.shape-menu button.is-active {
  background: var(--sketch-color-control-hover);
}

.brush-controls {
  position: absolute;
  z-index: var(--sketch-z-brush-controls);
  top: 50%;
  left: 6px;
  display: flex;
  width: 48px;
  align-items: center;
  flex-direction: column;
  transform: translateY(-50%);
}

.size-control {
  position: relative;
  width: 48px;
  height: var(--sketch-slider-height);
  cursor: ns-resize;
  touch-action: none;
}

.size-control__track {
  position: absolute;
  top: var(--sketch-slider-inset);
  bottom: var(--sketch-slider-inset);
  left: 50%;
  width: 2px;
  border-radius: var(--sketch-radius-pill);
  background: var(--sketch-slider-track);
  transform: translateX(-50%);
  transition: opacity var(--sketch-transition-fast);
}

.size-control__scale {
  position: absolute;
  top: var(--sketch-slider-inset);
  left: 8px;
  width: 32px;
  height: 192px;
  background: var(--sketch-slider-scale);
  clip-path: polygon(0 0, 100% 0, 53% 100%, 47% 100%);
  opacity: 0;
  pointer-events: none;
  transform: scaleX(0.06);
  transform-origin: 50% 100%;
  transition: opacity var(--sketch-transition-fast), transform var(--sketch-transition-expand);
}

.size-control__thumb {
  position: absolute;
  left: 8px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  transition: background-color var(--sketch-transition-fast);
}

.size-control__thumb::after {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sketch-slider-thumb);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
  content: "";
  transition: transform var(--sketch-transition-fast), box-shadow var(--sketch-transition-fast);
}

.size-control:hover .size-control__track,
.size-control:focus-visible .size-control__track,
.size-control.is-dragging .size-control__track {
  opacity: 0;
}

.size-control:hover .size-control__scale,
.size-control:focus-visible .size-control__scale,
.size-control.is-dragging .size-control__scale {
  opacity: 1;
  transform: scaleX(1);
}

.size-control:hover .size-control__thumb,
.size-control.is-dragging .size-control__thumb {
  background: var(--sketch-slider-thumb-hover);
}

.size-control:hover .size-control__thumb::after,
.size-control.is-dragging .size-control__thumb::after {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18), 0 2px 4px rgba(0, 0, 0, 0.28);
  transform: scale(1.08);
}

.size-control:focus-visible {
  border-radius: var(--sketch-radius-sm);
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

.bottom-controls {
  position: absolute;
  z-index: var(--sketch-z-controls);
  right: var(--sketch-space-3);
  bottom: var(--sketch-space-3);
  left: var(--sketch-space-3);
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.color-palette {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--sketch-space-2);
  margin: 0;
  padding: 6px 4px;
  border: 0;
  pointer-events: auto;
}

.color-button {
  position: relative;
  display: block;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: scale var(--sketch-transition-fast), box-shadow var(--sketch-transition-fast);
}

.color-button:hover {
  scale: 1.05;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25), 0 1px 3px rgba(0, 0, 0, 0.1);
}

.color-button.is-selected {
  box-shadow: 0 0 0 2px var(--sketch-color-surface), 0 0 0 4px #2c67c5;
}

.custom-color {
  overflow: hidden;
  border: 0;
  background: var(--sketch-color-surface);
}

.custom-color::before {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444);
  content: "";
}

.custom-color:hover {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
}

.custom-color:has(input:focus-visible) {
  outline-color: #2c67c5;
}

.custom-color input {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.finish-button {
  position: absolute;
  right: 0;
  display: grid;
  width: 36px;
  height: 36px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #ffffff;
  color: var(--sketch-color-surface);
  cursor: pointer;
  pointer-events: auto;
  transition: background-color var(--sketch-transition-fast), opacity var(--sketch-transition-fast);
}

.finish-button:hover:not(:disabled) {
  background: #dedede;
}

.finish-button:disabled {
  background: rgba(255, 255, 255, 0.41);
  color: #424242;
  opacity: 0.35;
  cursor: not-allowed;
}

.finish-button:focus-visible,
.color-button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 3px;
}

.brush-cursor {
  position: absolute;
  z-index: calc(var(--sketch-z-controls) - 1);
  border: 1px solid rgba(0, 0, 0, 0.42);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 80ms ease;
}

.canvas-text-input {
  position: absolute;
  z-index: var(--sketch-z-popover);
  min-width: 148px;
  max-width: min(360px, calc(100% - 32px));
  padding: 5px 8px;
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: var(--sketch-radius-sm);
  background: rgba(18, 18, 18, 0.94);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.25;
  user-select: text;
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

  .editor-header {
    top: var(--sketch-space-2);
    right: var(--sketch-space-2);
    left: var(--sketch-space-2);
    grid-template-columns: 1fr 1fr;
  }

  .close-button {
    justify-self: start;
  }

  .action-group {
    grid-column: 2;
    grid-row: 1;
  }

  .tool-group {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: center;
    margin-top: var(--sketch-space-2);
  }

  .brush-controls {
    top: auto;
    bottom: 56px;
    left: var(--sketch-space-3);
    width: auto;
    flex-direction: row;
    transform: none;
  }

  .bottom-controls {
    justify-content: flex-start;
  }

  .size-control {
    width: min(42vw, 180px);
    height: 48px;
    cursor: ew-resize;
  }

  .size-control__track {
    top: 50%;
    right: var(--sketch-slider-inset);
    bottom: auto;
    left: var(--sketch-slider-inset);
    width: auto;
    height: 2px;
    transform: translateY(-50%);
  }

  .size-control:hover .size-control__track,
  .size-control:focus-visible .size-control__track,
  .size-control.is-dragging .size-control__track {
    opacity: 1;
  }

  .size-control__scale {
    display: none;
  }

  .size-control__thumb {
    top: 8px !important;
    left: clamp(0px, calc(var(--slider-percent) - 16px), calc(100% - 32px));
  }

  .color-palette {
    width: calc(100% - 52px);
    max-width: 448px;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .color-palette::-webkit-scrollbar {
    display: none;
  }
}

@media (max-width: 420px) {
  .tool-group {
    gap: 0;
    padding: 2px;
  }
}
</style>
