<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ColorPalette from "./ColorPalette.vue";
import ObjectContextMenu from "./ObjectContextMenu.vue";
import OutputActions from "./OutputActions.vue";
import SketchSelectionFrame from "./SketchSelectionFrame.vue";
import SketchToolbar from "./SketchToolbar.vue";
import StrokeSizeControl from "./StrokeSizeControl.vue";
import StrokeSizePreview from "./StrokeSizePreview.vue";
import SketchTextEditor from "./SketchTextEditor.vue";
import { useHistory } from "../../composables/useHistory.js";
import { useSketchState } from "../../composables/useSketchState.js";
import { useSketchControls } from "../../composables/useSketchControls.js";
import { useSketchPointer } from "../../composables/useSketchPointer.js";
import { useSketchSelection } from "../../composables/useSketchSelection.js";
import { useSketchTextEditor } from "../../composables/useSketchTextEditor.js";
import { useSketchKonvaCanvas } from "../../composables/useSketchKonvaCanvas.js";
import { useSketchImageImport } from "../../composables/useSketchImageImport.js";
import { useSketchOutput } from "../../composables/useSketchOutput.js";
import { useSketchDialogLayout } from "../../composables/useSketchDialogLayout.js";
import { closePopover, openPopover } from "../../composables/usePopover.js";
import { isSelectionFrameHit as hitSelectionFrame, resizeCursor as getResizeCursor } from "../../utils/hitTest.js";
import { drawFreehand, drawShape } from "../../utils/sketchDrawing.js";
import { createSketchCamera } from "../../utils/sketchCamera.js";
import { inverseRotatePoint, rectCenter, rotatePoint } from "../../utils/sketchGeometry.js";
import { locale } from "../../locales/index.js";

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  submit: {
    type: Function,
    default: null,
  },
  embedded: Boolean,
  initialLayout: {
    type: String,
    default: "ratio",
  },
  layout: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(["update:modelValue", "update:layout", "download"]);
const teleportTarget = inject("TeleportTarget", "body");

const dialog = ref(null);
const textInput = ref(null);
const objectContextMenu = ref(null);
const {
  activeTool, activeShape, strokeColor, strokeSize, backgroundColor, commands, selectedIndex,
  activePopover, controlsOutside, canvasRatio, textEditor,
  textValue, selectionCursor, selectedCommand, hasContent,
} = useSketchState();
const pointerCursor = ref({ x: 0, y: 0, visible: false });
const statusMessage = ref("");
const strokeSizePreviewVisible = ref(false);
const backgroundPreviewColor = ref(null);
const canvasBackgroundColor = computed(() => backgroundPreviewColor.value || backgroundColor.value);

let textTransform = null;
let commandId = 0;

const textEditorPadding = 6;
const textEditorMinWidth = 48;
const textEditorDefaultWidth = 240;
const textLineHeight = 1.25;
const textMinSize = 12;
const textMaxSize = 160;

const copy = locale.sketch;
const toolLabels = copy.tools;
let selectionApi;
const {
  container: stage,
  stage: konvaStage,
  backgroundLayer,
  backgroundRect,
  contentLayer,
  overlayLayer,
  stageSize,
  zoom,
  pan,
  panMode,
  spacePressed,
  isPanning,
  minZoom,
  maxZoom,
  zoomPercent,
  stageConfig,
  backgroundConfig,
  measurementContext,
  drawContentScene,
  drawOverlayScene,
  render,
  renderLive,
  renderEraserPreview,
  resizeCanvases,
  eventPoint,
  zoomBy,
  resetView,
  handleWheel,
  setPanMode,
  setSpacePressed,
  startPan,
  movePan,
  finishPan,
  cancelPan,
  createOutputCanvas,
} = useSketchKonvaCanvas({
  commands,
  backgroundColor: canvasBackgroundColor,
  isTextEditing: () => Boolean(textEditor.value),
  beforeRender: migrateLegacyCommands,
  drawCommand,
  drawSelection: (context) => selectionApi?.drawSelection(context),
});
const {
  drawingRatio,
  ratioValue,
  dialogStyle,
  interfaceFullscreen,
  browserFullscreen,
  isFullscreen,
  effectiveControlsOutside,
  changeCanvasRatio,
  toggleBrowserFullscreen,
} = useSketchDialogLayout({
  dialog,
  stage,
  controlsOutside,
  canvasRatio,
  commands,
  initialLayout: props.initialLayout,
  getLayout: () => props.layout,
  getEmbedded: () => props.embedded,
  getModelValue: () => props.modelValue,
  emitLayout: (value) => emit("update:layout", value),
  resizeCanvases,
  announce,
});
const camera = computed(() => createSketchCamera({
  width: stageSize.value.width,
  height: stageSize.value.height,
  worldAspect: drawingRatio.value,
  zoom: zoom.value,
  pan: pan.value,
}));

const canvasCursor = computed(() => {
  if (isPanning.value) return "grabbing";
  if (panMode.value || spacePressed.value) return "grab";
  if (activeTool.value === "select") return selectedIndex.value >= 0 ? selectionCursor.value : "default";
  if (activeTool.value === "text") return "text";
  if (activeTool.value === "shape") return "crosshair";
  return pointerCursor.value.visible ? "none" : "default";
});
const pointerCursorStyle = computed(() => ({
  width: `${Math.max(strokeSize.value, 6)}px`,
  height: `${Math.max(strokeSize.value, 6)}px`,
  backgroundColor: activeTool.value === "eraser" ? "#a8a8a8" : strokeColor.value,
  left: `${pointerCursor.value.x}px`,
  top: `${pointerCursor.value.y}px`,
  opacity: pointerCursor.value.visible && !panMode.value && !spacePressed.value && !isPanning.value && ["pen", "eraser"].includes(activeTool.value) ? 1 : 0,
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
    fontSize: `${displaySize(command)}px`,
    lineHeight: textLineHeight,
    transform: `rotate(${command.rotation || 0}rad)`,
    transformOrigin: "center",
    "--selection-counter-rotation": `${-(command.rotation || 0)}rad`,
  };
});
const textRotateAbove = computed(() => {
  if (!textEditor.value) return false;
  const command = commands.value[textEditor.value.index];
  if (!command) return false;
  const bounds = textEditorBounds(command);
  return bounds.y + bounds.height + 50 > stageSize.value.height;
});

const { undoStack, redoStack, canUndo, canRedo, clone, pushHistory, undo, redo } = useHistory(
  () => commands.value,
  (restored, message, context) => {
    closeObjectContextMenu();
    commands.value = restored;
    if (context?.backgroundColor) backgroundColor.value = context.backgroundColor;
    selectedIndex.value = -1;
    selectionCursor.value = "default";
    render();
    announce(message);
  },
  () => render(),
  () => ({ backgroundColor: backgroundColor.value }),
  { undo: copy.messages.undone, redo: copy.messages.redone },
);
const {
  imageInput,
  imageLoading,
  imageDragActive,
  getImage,
  openImagePicker,
  addImage,
  handleImageDragEnter,
  handleImageDragOver,
  handleImageDragLeave,
  handleImageDrop,
} = useSketchImageImport({
  stage,
  stageSize,
  commands,
  activeTool,
  selectedIndex,
  selectionCursor,
  clone,
  pushHistory,
  announce,
  normalizePoint,
  eventPoint,
  setPanMode,
});
const { copySucceeded, attaching, copyCanvas, downloadCanvas, attachCanvas } = useSketchOutput({
  hasContent,
  createOutputCanvas,
  getSubmit: () => props.submit,
  emitDownload: (filename) => emit("download", filename),
  announce,
  close: closeDialog,
});
let controls;
const displaySize = (command) => command.worldSize ? camera.value.toScreenDistance(command.size) : command.size;
const { textLayout, textEditorBounds, startText, beginTextEdit, commitText, cancelText, resizeTextCommand, startTextTransform, moveTextTransform, finishTextTransform } = useSketchTextEditor({ commands, selectedIndex, activeTool, strokeColor, selectionCursor, textEditor, textValue, clone, pushHistory, announce, render, selectCommand: (...args) => controls.selectCommand(...args), normalizePoint, pixelPoint, eventPoint, getStageSize: () => stageSize.value, getContext: () => measurementContext, input: textInput, getCamera: () => camera.value, displaySize, transformMasks: transformCommandMasks });
controls = useSketchControls({ state: { activeTool, activeShape, strokeColor, strokeSize, commands, selectedIndex, activePopover, controlsOutside, canvasRatio, textEditor, selectionCursor, selectedCommand }, clone, pushHistory, render, resizeCanvases, announce, commitText, onRatioChange: changeCanvasRatio, getCurrentRatio: () => interfaceFullscreen.value ? "fill" : canvasRatio.value, getViewScale: () => camera.value.scale });
const { selectTool: selectDrawingTool, toggleShapeMenu: openShapeMenu, toggleControlsOutside, toggleRatioMenu, selectShape, selectCommand, setStrokeSize, setStrokeColor } = controls;

async function toggleCanvasControls() {
  if (props.embedded && interfaceFullscreen.value) {
    interfaceFullscreen.value = false;
    await nextTick();
  }
  toggleControlsOutside();
}

function showStrokeSizePreview() {
  strokeSizePreviewVisible.value = true;
}

function hideStrokeSizePreview() {
  strokeSizePreviewVisible.value = false;
}
selectionApi = useSketchSelection({ commands, selectedIndex, pixelPoint, textLayout, getStageSize: () => stageSize.value, displaySize });
const { commandBounds, geometryBounds, selectionBounds, rotatedSelectionBounds, findResizeHandle, resizeBounds, findCommand } = selectionApi;
const selectionFrame = computed(() => {
  const command = selectedCommand.value;
  if (textEditor.value || !command || (command.type === "shape" && ["line", "arrow"].includes(command.shape))) return null;
  const bounds = selectionBounds(command);
  const rotation = command.rotation || 0;
  return {
    frameStyle: {
      left: `${bounds.x}px`,
      top: `${bounds.y}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      transform: `rotate(${rotation}rad)`,
      "--selection-counter-rotation": `${-rotation}rad`,
    },
    rotateAbove: bounds.y + bounds.height + 50 > stageSize.value.height,
  };
});
const canMoveBackward = computed(() => selectedIndex.value > 0);
const canMoveForward = computed(() => selectedIndex.value >= 0 && selectedIndex.value < commands.value.length - 1);
const objectContextMenuStyle = computed(() => {
  if (!objectContextMenu.value) return {};
  const width = 168;
  const height = 146;
  const gap = 8;
  const left = Math.min(stageSize.value.width - width - gap, Math.max(gap, objectContextMenu.value.x));
  const top = Math.min(stageSize.value.height - height - gap, Math.max(gap, objectContextMenu.value.y));
  return { left: `${left}px`, top: `${top}px` };
});

function announce(message) {
  statusMessage.value = "";
  requestAnimationFrame(() => {
    statusMessage.value = message;
  });
}

function normalizePoint(point) {
  return camera.value.toWorld(point);
}

function pixelPoint(point) {
  return camera.value.toScreen(point);
}

function createCommandId() {
  return crypto.randomUUID?.() || `sketch-object-${Date.now()}-${commandId += 1}`;
}

function migrateCommandGeometry(command, activeCamera) {
  if (command.worldSize) return;
  const toWorld = (point) => activeCamera.toWorld({ x: point.x * stageSize.value.width, y: point.y * stageSize.value.height, pressure: point.pressure });
  if (["text", "image"].includes(command.type)) {
    const point = toWorld(command);
    command.x = point.x;
    command.y = point.y;
    command.width = activeCamera.toWorldXDistance((command.width || 0) * stageSize.value.width);
    if (command.type === "image") command.height = activeCamera.toWorldDistance((command.height || 0) * stageSize.value.height);
  } else if (command.type === "shape") {
    command.start = toWorld(command.start);
    command.end = toWorld(command.end);
  } else {
    command.points = command.points.map(toWorld);
  }
  if (command.size != null) command.size = activeCamera.toWorldDistance(command.size);
  command.worldSize = true;
}

function migrateLegacyCommands() {
  const activeCamera = camera.value;
  const selected = commands.value[selectedIndex.value];
  const objects = [];
  let hasLegacyErasers = false;
  commands.value.forEach((command) => {
    migrateCommandGeometry(command, activeCamera);
    if (command.type === "eraser") {
      objects.forEach((object) => object.masks.push(JSON.parse(JSON.stringify(command))));
      hasLegacyErasers = true;
      return;
    }
    command.id ||= createCommandId();
    command.masks ||= [];
    command.masks.forEach((mask) => migrateCommandGeometry(mask, activeCamera));
    objects.push(command);
  });
  if (!hasLegacyErasers) return;
  commands.value = objects;
  selectedIndex.value = selected ? objects.indexOf(selected) : -1;
}

function drawCommand(context, command, preview = false) {
  context.save();
  try {
    const rotation = command.rotation || 0;
    if (rotation) {
      const center = rectCenter(selectionApi.geometryBounds(command));
      context.translate(center.x, center.y);
      context.rotate(rotation);
      context.translate(-center.x, -center.y);
    }

    if (command.type === "image") {
      const image = getImage(command.assetId);
      if (!image) return;
      const start = pixelPoint(command);
      const end = pixelPoint({ x: command.x + command.width, y: command.y + command.height });
      context.drawImage(image, start.x, start.y, end.x - start.x, end.y - start.y);
      return;
    }
    const drawable = command.worldSize ? { ...command, size: camera.value.toScreenDistance(command.size) } : command;
    if (["pen", "eraser"].includes(drawable.type)) {
      drawFreehand(context, drawable, pixelPoint, preview);
      return;
    }
    if (drawable.type === "shape") {
      drawShape(context, drawable, pixelPoint);
      return;
    }
    if (command.type === "text") {
      if (textEditor.value?.index === commands.value.indexOf(command)) return;
      const point = pixelPoint(command);
      const layout = textLayout(command);
      context.fillStyle = command.color;
      const fontSize = displaySize(command);
      const leading = (layout.lineHeight - fontSize) / 2;
      context.font = `600 ${fontSize}px Inter, sans-serif`;
      context.textBaseline = "top";
      layout.lines.forEach((line, index) => {
        context.fillText(line, point.x, point.y + leading + index * layout.lineHeight, layout.width);
      });
    }
  } finally {
    context.restore();
  }
}

function translateCommand(command, dx, dy) {
  if (["text", "image"].includes(command.type)) {
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
  command.masks?.forEach((mask) => mask.points.forEach((point) => {
    point.x += dx;
    point.y += dy;
  }));
}

function transformCommandMasks(command, originalCommand, originalBounds, nextBounds = selectionBounds(command)) {
  if (!originalCommand.masks?.length || !originalBounds.width || !originalBounds.height) return;
  const scaleX = nextBounds.width / originalBounds.width;
  const scaleY = nextBounds.height / originalBounds.height;
  const sizeScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
  const originalCenter = rectCenter(originalBounds);
  const nextCenter = rectCenter(nextBounds);
  const originalRotation = originalCommand.rotation || 0;
  const nextRotation = command.rotation || 0;
  command.masks = originalCommand.masks.map((mask) => ({
    ...mask,
    size: mask.size * sizeScale,
    points: mask.points.map((point) => {
      const local = inverseRotatePoint(pixelPoint(point), originalCenter, originalRotation);
      const transformed = rotatePoint({
        x: nextBounds.x + (local.x - originalBounds.x) * scaleX,
        y: nextBounds.y + (local.y - originalBounds.y) * scaleY,
        pressure: point.pressure,
      }, nextCenter, nextRotation);
      return normalizePoint({
        x: transformed.x,
        y: transformed.y,
        pressure: point.pressure,
      });
    }),
  }));
}

function oppositeAnchor(bounds, handleId) {
  const center = rectCenter(bounds);
  return {
    x: handleId.includes("w") ? bounds.x + bounds.width : handleId.includes("e") ? bounds.x : center.x,
    y: handleId.includes("n") ? bounds.y + bounds.height : handleId.includes("s") ? bounds.y : center.y,
  };
}

function finalizeResize(command, gestureState) {
  const rotation = gestureState.originalCommand.rotation || 0;
  if (rotation) {
    const originalBounds = gestureState.originalSelectionBounds;
    const nextBounds = selectionBounds(command);
    const originalAnchor = rotatePoint(oppositeAnchor(originalBounds, gestureState.handle.id), rectCenter(originalBounds), rotation);
    const nextAnchor = rotatePoint(oppositeAnchor(nextBounds, gestureState.handle.id), rectCenter(nextBounds), rotation);
    const originalWorld = normalizePoint(originalAnchor);
    const nextWorld = normalizePoint(nextAnchor);
    translateCommand(command, originalWorld.x - nextWorld.x, originalWorld.y - nextWorld.y);
  }
  transformCommandMasks(command, gestureState.originalCommand, gestureState.originalSelectionBounds, selectionBounds(command));
}

function rotateCommand(command, point, gestureState, snap = false) {
  const currentAngle = Math.atan2(point.y - gestureState.center.y, point.x - gestureState.center.x);
  let rotation = gestureState.originalRotation + currentAngle - gestureState.startAngle;
  if (snap) {
    const step = Math.PI / 12;
    rotation = Math.round(rotation / step) * step;
  }
  command.rotation = rotation;
  transformCommandMasks(command, gestureState.originalCommand, gestureState.originalSelectionBounds, gestureState.originalSelectionBounds);
}

function applyEraser(command) {
  if (!command?.points.length || !commands.value.length) return false;
  const eraserBounds = commandBounds(command);
  let applied = false;
  commands.value.forEach((object) => {
    const bounds = rotatedSelectionBounds(object);
    const intersects = eraserBounds.x <= bounds.x + bounds.width && eraserBounds.x + eraserBounds.width >= bounds.x && eraserBounds.y <= bounds.y + bounds.height && eraserBounds.y + eraserBounds.height >= bounds.y;
    if (!intersects) return;
    object.masks ||= [];
    object.masks.push(clone(command));
    applied = true;
  });
  return applied;
}

function resizeCommand(command, point, gestureState, preserveAspect = false) {
  const handle = gestureState.handle;
  const rotation = gestureState.originalCommand.rotation || 0;
  const localPoint = inverseRotatePoint(point, rectCenter(gestureState.originalSelectionBounds), rotation);
  const normalized = normalizePoint(localPoint);

  if (command.type === "shape" && ["line", "arrow"].includes(command.shape)) {
    command[handle.id] = normalized;
    transformCommandMasks(command, gestureState.originalCommand, gestureState.originalSelectionBounds);
    return;
  }

  if (command.type === "shape") {
    const padding = displaySize(command) / 2 + 1;
    const targetSelection = resizeBounds(gestureState.originalSelectionBounds, handle.id, localPoint, preserveAspect);
    const left = Math.min(targetSelection.x, targetSelection.x + targetSelection.width) + padding;
    const right = Math.max(targetSelection.x, targetSelection.x + targetSelection.width) - padding;
    const top = Math.min(targetSelection.y, targetSelection.y + targetSelection.height) + padding;
    const bottom = Math.max(targetSelection.y, targetSelection.y + targetSelection.height) - padding;
    command.start = normalizePoint({ x: left, y: top });
    command.end = normalizePoint({ x: right, y: bottom });
    finalizeResize(command, gestureState);
    return;
  }

  if (command.type === "text") {
    resizeTextCommand(command, localPoint, gestureState);
    finalizeResize(command, gestureState);
    return;
  }

  if (command.type === "image") {
    const target = resizeBounds(gestureState.originalSelectionBounds, handle.id, localPoint, preserveAspect);
    const left = Math.min(target.x, target.x + target.width);
    const right = Math.max(target.x, target.x + target.width);
    const top = Math.min(target.y, target.y + target.height);
    const bottom = Math.max(target.y, target.y + target.height);
    const start = normalizePoint({ x: left, y: top });
    const end = normalizePoint({ x: right, y: bottom });
    command.x = start.x;
    command.y = start.y;
    command.width = end.x - start.x;
    command.height = end.y - start.y;
    finalizeResize(command, gestureState);
    return;
  }

  if (command.type === "pen") {
    const originalBounds = gestureState.originalBounds;
    const padding = displaySize(command) / 2 + 1;
    const targetSelection = resizeBounds(gestureState.originalSelectionBounds, handle.id, localPoint, preserveAspect);
    const targetGeometry = {
      x: targetSelection.x + padding,
      y: targetSelection.y + padding,
      width: targetSelection.width - padding * 2,
      height: targetSelection.height - padding * 2,
    };
    const scaleX = targetGeometry.width / Math.max(originalBounds.width, 1);
    const scaleY = targetGeometry.height / Math.max(originalBounds.height, 1);

    command.points = gestureState.originalCommand.points.map((originalPoint) => {
      const pixel = pixelPoint(originalPoint);
      return normalizePoint({
        x: targetGeometry.x + (pixel.x - originalBounds.x) * scaleX,
        y: targetGeometry.y + (pixel.y - originalBounds.y) * scaleY,
        pressure: originalPoint.pressure,
      });
    });
    finalizeResize(command, gestureState);
  }
}

function updatePointerCursor(point, visible = true) {
  pointerCursor.value = { x: point.x, y: point.y, visible };
}

function isPointInCanvas(point) {
  return point.x >= 0 && point.y >= 0 && point.x <= stageSize.value.width && point.y <= stageSize.value.height;
}

const { onPointerDown, onCanvasDoubleClick, onPointerMove, finishPointer, onCanvasLeave } = useSketchPointer({
  activeTool, activeShape, strokeColor, strokeSize, activePopover, commands, selectedIndex, selectedCommand, selectionCursor,
  pointerCursor, clone, pushHistory, announce, selectCommand, findResizeHandle, findCommand, selectionBounds, geometryBounds,
  resizeCommand, rotateCommand, translateCommand, normalizePoint, pixelPoint, eventPoint, render, renderLive, renderEraserPreview, startText,
  beginTextEdit, updatePointerCursor, isPointInCanvas, getResizeCursor, hitSelectionFrame, getViewScale: () => camera.value.scale, applyEraser,
});

function handleStagePointerDown(event) {
  if (startPan(event)) {
    closePopover();
    pointerCursor.value.visible = false;
    return;
  }
  onPointerDown(event);
}

function handleStagePointerMove(event) {
  if (movePan(event)) return;
  onPointerMove(event);
}

function finishStagePointer(event, cancelled = false) {
  if (finishPan(event)) return;
  finishPointer(event, cancelled);
}

function cancelWindowPointer(event) {
  finishStagePointer(event, true);
}

function zoomCanvas(factor) {
  if (!zoomBy(factor)) return;
  announce(copy.messages.canvasZoom(zoomPercent.value));
}

function resetCanvasView() {
  if (!resetView()) return;
  announce(copy.messages.canvasViewReset);
}

function toggleCanvasPan() {
  setPanMode();
  pointerCursor.value.visible = false;
  announce(panMode.value ? copy.messages.panEnabled : copy.messages.panDisabled);
}

function moveSelectedObject(targetIndex, message) {
  const from = selectedIndex.value;
  if (from < 0) return;
  const boundedTarget = Math.min(commands.value.length - 1, Math.max(0, targetIndex));
  if (from === boundedTarget) return;
  const previous = clone();
  const [command] = commands.value.splice(from, 1);
  commands.value.splice(boundedTarget, 0, command);
  selectedIndex.value = boundedTarget;
  closeObjectContextMenu();
  pushHistory(previous);
  announce(message);
}

function closeObjectContextMenu() {
  objectContextMenu.value = null;
}

function openObjectContextMenu(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
  event.preventDefault();
  const point = eventPoint(event);
  const index = findCommand(point);
  if (index < 0) {
    closeObjectContextMenu();
    return;
  }
  if (textEditor.value) commitText();
  closePopover();
  setPanMode(false);
  activeTool.value = "select";
  selectedIndex.value = index;
  selectionCursor.value = "grab";
  objectContextMenu.value = { x: point.x, y: point.y };
  render();
}

function sendSelectedToBack() {
  moveSelectedObject(0, copy.messages.sentToBack);
}

function moveSelectedBackward() {
  moveSelectedObject(selectedIndex.value - 1, copy.messages.movedBackward);
}

function moveSelectedForward() {
  moveSelectedObject(selectedIndex.value + 1, copy.messages.movedForward);
}

function bringSelectedToFront() {
  moveSelectedObject(commands.value.length - 1, copy.messages.broughtToFront);
}

function selectTool(tool) {
  setPanMode(false);
  selectDrawingTool(tool);
}

function toggleShapeMenu(anchor) {
  setPanMode(false);
  openShapeMenu(anchor);
}

function confirmClearCanvas() {
  if (!hasContent.value) return;
  const previous = clone();
  commands.value = [];
  drawingRatio.value = ratioValue.value;
  selectedIndex.value = -1;
  selectionCursor.value = "default";
  closePopover();
  pushHistory(previous);
  resetView();
  announce(copy.messages.canvasCleared);
}

function requestClearCanvas(anchor) {
  if (activePopover.value === "clear") closePopover();
  else openPopover("clear", anchor, { confirm: confirmClearCanvas, cancel: closePopover });
}

function toggleBackgroundMenu(anchor) {
  if (activePopover.value === "background") closePopover();
  else openPopover("background", anchor, { preview: previewBackgroundColor, select: setBackgroundColor }, { get current() { return backgroundColor.value; } });
}

function toggleViewMenu(anchor) {
  if (activePopover.value === "view") {
    closePopover();
    return;
  }
  openPopover("view", anchor, {
    togglePan: toggleCanvasPan,
    zoomIn: () => zoomCanvas(1.2),
    zoomOut: () => zoomCanvas(1 / 1.2),
    reset: resetCanvasView,
  }, {
    get zoomPercent() { return zoomPercent.value; },
    get panActive() { return panMode.value; },
    get canZoomIn() { return zoom.value < maxZoom; },
    get canZoomOut() { return zoom.value > minZoom; },
  });
}

function previewBackgroundColor(color) {
  if (!color || color === canvasBackgroundColor.value) return;
  backgroundPreviewColor.value = color;
  render();
}

function setBackgroundColor(color) {
  if (!color || color === backgroundColor.value) return;
  const previous = clone();
  const previousContext = { backgroundColor: backgroundColor.value };
  backgroundColor.value = color;
  backgroundPreviewColor.value = null;
  pushHistory(previous, previousContext);
  render();
  announce(copy.messages.backgroundUpdated);
}

function closeDialog() {
  closeObjectContextMenu();
  emit("update:modelValue", false);
}

function onKeydown(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    setSpacePressed(true);
    pointerCursor.value.visible = false;
    return;
  }
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && selectedIndex.value >= 0 && ["BracketLeft", "BracketRight"].includes(event.code)) {
    event.preventDefault();
    if (event.code === "BracketLeft") event.shiftKey ? sendSelectedToBack() : moveSelectedBackward();
    else event.shiftKey ? bringSelectedToFront() : moveSelectedForward();
    return;
  }
  if (modifier && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  }
  if (event.key === "Escape" && objectContextMenu.value) {
    closeObjectContextMenu();
    return;
  }
  if (event.key === "Escape" && panMode.value) {
    setPanMode(false);
    announce(copy.messages.panDisabled);
    return;
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
      ArrowUp: [0, -camera.value.toWorldDistance(distance)],
      ArrowRight: [camera.value.toWorldXDistance(distance), 0],
      ArrowDown: [0, camera.value.toWorldDistance(distance)],
      ArrowLeft: [-camera.value.toWorldXDistance(distance), 0],
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
    closeObjectContextMenu();
    pushHistory(previous);
    announce(copy.messages.objectDeleted);
  }
}

function onKeyup(event) {
  if (event.code === "Space") setSpacePressed(false);
}

watch(strokeSize, (size) => announce(copy.messages.brushSize(size)));
watch(activePopover, (active, previous) => {
  if (previous === "background" && active !== "background" && backgroundPreviewColor.value) {
    backgroundPreviewColor.value = null;
    render();
  }
});
watch(textValue, (value) => {
  if (!textEditor.value) return;
  const command = commands.value[textEditor.value.index];
  if (command) command.text = value;
});

onMounted(() => {
  window.addEventListener("pointerup", finishStagePointer);
  window.addEventListener("pointercancel", cancelWindowPointer);
  window.addEventListener("blur", cancelPan);
});

onBeforeUnmount(() => {
  cancelPan();
  window.removeEventListener("pointerup", finishStagePointer);
  window.removeEventListener("pointercancel", cancelWindowPointer);
  window.removeEventListener("blur", cancelPan);
});
</script>

<template>
  <Teleport :to="teleportTarget">
    <div v-show="modelValue" class="sketch-modal chat-sketch-canvas" :class="{ 'is-interface-fullscreen': interfaceFullscreen, 'is-embedded': embedded }">
      <div class="sketch-backdrop"></div>
      <div ref="dialog" class="sketch-dialog" :style="dialogStyle" :role="embedded ? 'main' : 'dialog'" :aria-modal="embedded ? undefined : true" aria-labelledby="sketch-dialog-title" tabindex="-1" @pointerdown="closeObjectContextMenu" @keydown="onKeydown" @keyup="onKeyup">
      <section class="sketch-editor" :class="{ 'is-controls-outside': effectiveControlsOutside }">
          <h2 id="sketch-dialog-title" class="sr-only">{{ copy.labels.dialog }}</h2>
        <div id="sketch-popover-host"></div>

        <SketchToolbar
          :active-tool="activeTool"
          :active-shape="activeShape"
          :shape-menu-open="activePopover === 'shape'"
          :can-undo="canUndo"
          :can-redo="canRedo"
          :is-fullscreen="isFullscreen"
          :is-browser-fullscreen="browserFullscreen"
          :has-content="hasContent"
          :controls-outside="effectiveControlsOutside"
          :zoom-percent="zoomPercent"
          :active-popover="activePopover"
          :image-loading="imageLoading"
          :embedded="embedded"
          @close="closeDialog"
          @select-tool="selectTool"
          @toggle-shapes="toggleShapeMenu"
          @select-shape="selectShape"
          @undo="undo"
          @redo="redo"
          @clear="requestClearCanvas"
          @toggle-controls="toggleCanvasControls"
          @toggle-ratio="toggleRatioMenu"
          @toggle-background="toggleBackgroundMenu"
          @toggle-browser-fullscreen="toggleBrowserFullscreen"
          @toggle-view="toggleViewMenu"
          @add-image="openImagePicker"
          @close-popover="closePopover"
        />

        <input ref="imageInput" hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="addImage" />


        <div class="sketch-body">
          <div
            ref="stage"
            class="sketch-stage"
            role="application"
            :aria-label="copy.labels.canvas"
            tabindex="0"
            :class="{ 'is-image-drag-active': imageDragActive, 'is-transparent-background': canvasBackgroundColor === 'transparent' }"
            :style="{ cursor: canvasCursor }"
            @dragenter="handleImageDragEnter"
            @dragover="handleImageDragOver"
            @dragleave="handleImageDragLeave"
            @drop="handleImageDrop"
            @pointerdown="handleStagePointerDown"
            @pointermove="handleStagePointerMove"
            @pointerup="finishStagePointer"
            @pointercancel="(event) => finishStagePointer(event, true)"
            @pointerenter="updatePointerCursor(eventPoint($event))"
            @pointerleave="onCanvasLeave"
            @contextmenu="openObjectContextMenu"
            @dblclick="panMode ? null : onCanvasDoubleClick($event)"
            @wheel="handleWheel"
          >
            <v-stage ref="konvaStage" class="konva-stage" :config="stageConfig">
              <v-layer ref="backgroundLayer" :config="{ listening: false }">
                <v-rect ref="backgroundRect" :config="backgroundConfig" />
              </v-layer>
              <v-layer ref="contentLayer" :config="{ listening: false }">
                <v-shape :config="{ listening: false, sceneFunc: drawContentScene }" />
              </v-layer>
              <v-layer ref="overlayLayer" :config="{ listening: false }">
                <v-shape :config="{ listening: false, sceneFunc: drawOverlayScene }" />
              </v-layer>
            </v-stage>

          <ObjectContextMenu
            v-if="objectContextMenu"
            :style="objectContextMenuStyle"
            :can-move-backward="canMoveBackward"
            :can-move-forward="canMoveForward"
            @pointerdown.stop
            @wheel.stop
            @send-to-back="sendSelectedToBack"
            @move-backward="moveSelectedBackward"
            @move-forward="moveSelectedForward"
            @bring-to-front="bringSelectedToFront"
          />

          <SketchSelectionFrame
            v-if="selectionFrame"
            :frame-style="selectionFrame.frameStyle"
            :rotate-above="selectionFrame.rotateAbove"
          />

          <span class="brush-cursor" :style="pointerCursorStyle" aria-hidden="true"></span>

          <StrokeSizePreview :visible="strokeSizePreviewVisible" :size="strokeSize" :color="strokeColor" />

          <SketchTextEditor
            v-if="textEditor"
            ref="textInput"
            v-model="textValue"
            class="canvas-text-editor"
            :style="textEditorStyle"
            :rotate-above="textRotateAbove"
            @transform-start="startTextTransform"
            @transform-move="moveTextTransform"
            @transform-end="finishTextTransform"
            @cancel="cancelText"
            @commit="commitText"
          />

          </div>
        </div>
        <ColorPalette :model-value="strokeColor" :outside="effectiveControlsOutside" @update:model-value="setStrokeColor" />
        <OutputActions :disabled="!hasContent" :can-copy="hasContent" :can-attach="Boolean(submit)" :attaching="attaching" :copy-succeeded="copySucceeded" :outside="effectiveControlsOutside" @attach="attachCanvas" @download="downloadCanvas" @copy="copyCanvas" />
        <StrokeSizeControl
          :model-value="strokeSize"
          :outside="effectiveControlsOutside"
          @adjust-start="showStrokeSizePreview"
          @adjust-end="hideStrokeSizePreview"
          @update:model-value="setStrokeSize"
        />
        <div class="sr-only" aria-live="polite">{{ statusMessage }}</div>
      </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sketch-modal {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
}

.sketch-backdrop {
  position: absolute;
  inset: 0;
  background: var(--sketch-color-backdrop);
  backdrop-filter: blur(3px);
}

.sketch-modal.is-interface-fullscreen {
  place-items: stretch;
}

.sketch-modal.is-interface-fullscreen .sketch-backdrop {
  display: none;
}

.sketch-modal.is-interface-fullscreen .sketch-dialog {
  width: 100vw;
  height: 100dvh;
  aspect-ratio: auto;
  border-radius: 0;
  box-shadow: none;
  transform: none;
}

.sketch-modal.is-embedded .sketch-backdrop {
  display: none;
}

.sketch-dialog {
  position: relative;
  width: min(760px, calc(100vw - 32px), calc((100dvh - 32px) * var(--sketch-ratio)));
  aspect-ratio: var(--sketch-ratio);
  height: auto;
  max-width: none;
  max-height: none;
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: var(--sketch-radius-md);
  background: transparent;
  color: var(--sketch-color-text);
  box-shadow: var(--sketch-shadow-dialog);
  transform: translateX(var(--sketch-outside-offset-x, 0));
  transition: width var(--sketch-transition-expand), aspect-ratio var(--sketch-transition-expand), transform var(--sketch-transition-expand);
}

.sketch-dialog {
  animation: dialog-in 220ms ease-out;
}

.sketch-editor,
.sketch-body,
.sketch-stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.sketch-editor {
  container-type: inline-size;
  overflow: visible;
  border-radius: inherit;
}

.sketch-body {
  display: block;
  overflow: hidden;
  border-radius: inherit;
  background: var(--sketch-color-surface);
}

.sketch-stage {
  background: var(--sketch-color-surface);
  touch-action: none;
  user-select: none;
}

.konva-stage,
.konva-stage :deep(.konvajs-content),
.sketch-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.sketch-stage {
  outline: none;
}

.sketch-stage.is-transparent-background {
  background-color: #181818;
  background-image: linear-gradient(45deg, #282828 25%, transparent 25%), linear-gradient(-45deg, #282828 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #282828 75%), linear-gradient(-45deg, transparent 75%, #282828 75%);
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  background-size: 20px 20px;
}

.sketch-stage::after {
  position: absolute;
  z-index: var(--sketch-z-controls);
  inset: 10px;
  border: 2px dashed transparent;
  border-radius: calc(var(--sketch-radius-md) - 8px);
  content: "";
  pointer-events: none;
  transition: border-color var(--sketch-transition-fast), background-color var(--sketch-transition-fast);
}

.sketch-stage.is-image-drag-active::after {
  border-color: var(--sketch-color-selection);
  background: rgba(109, 216, 183, 0.06);
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

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translate(var(--sketch-outside-offset-x, 0), 8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateX(var(--sketch-outside-offset-x, 0));
  }
}

@media (max-width: 640px) {
  .sketch-dialog {
    width: min(calc(100vw - 16px), calc((100dvh - 16px) * var(--sketch-ratio)));
  }

}
</style>
