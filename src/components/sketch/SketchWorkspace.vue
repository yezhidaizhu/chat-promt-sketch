<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ColorPalette from "./ColorPalette.vue";
import SketchToolbar from "./SketchToolbar.vue";
import StrokeSizeControl from "./StrokeSizeControl.vue";
import SketchTextEditor from "./SketchTextEditor.vue";
import { useHistory } from "../../composables/useHistory.js";
import { useSketchState } from "../../composables/useSketchState.js";
import { useSketchControls } from "../../composables/useSketchControls.js";
import { useSketchPointer } from "../../composables/useSketchPointer.js";
import { useSketchSelection } from "../../composables/useSketchSelection.js";
import { useSketchTextEditor } from "../../composables/useSketchTextEditor.js";
import { closePopover, openPopover } from "../../composables/usePopover.js";
import { isSelectionFrameHit as hitSelectionFrame, resizeCursor as getResizeCursor } from "../../utils/hitTest.js";
import { drawFreehand, drawShape, prepareContext } from "../../utils/sketchDrawing.js";
import { createSketchCamera } from "../../utils/sketchCamera.js";
import { locale } from "../../locales/index.js";

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
const {
  activeTool, activeShape, strokeColor, strokeSize, backgroundColor, commands, selectedIndex,
  activePopover, controlsOutside, canvasRatio, textEditor,
  textValue, selectionCursor, selectedCommand, hasContent,
} = useSketchState();
const pointerCursor = ref({ x: 0, y: 0, visible: false });
const statusMessage = ref("");
const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
const copySucceeded = ref(false);
const backgroundPreviewColor = ref(null);
const drawingRatio = ref(1);
const stageRevision = ref(0);
const interfaceFullscreen = ref(false);
const browserFullscreen = ref(Boolean(document.fullscreenElement));
const isFullscreen = computed(() => interfaceFullscreen.value || browserFullscreen.value);
const effectiveControlsOutside = computed(() => controlsOutside.value && !isFullscreen.value);
const canvasBackgroundColor = computed(() => backgroundPreviewColor.value || backgroundColor.value);

let committedContext;
let liveContext;
let stageSize = { width: 1, height: 1 };
let textTransform = null;
let resizeObserver;
let copyFeedbackTimer;
let browserFullscreenTransition;

const textEditorPadding = 6;
const textEditorMinWidth = 48;
const textEditorDefaultWidth = 240;
const textLineHeight = 1.25;
const textMinSize = 12;
const textMaxSize = 160;

const copy = locale.sketch;
const toolLabels = copy.tools;
const ratioValue = computed(() => {
  const [width, height] = canvasRatio.value.split(":").map(Number);
  return width / height;
});
const camera = computed(() => {
  stageRevision.value;
  return createSketchCamera({ width: stageSize.width, height: stageSize.height, worldAspect: drawingRatio.value });
});
const dialogStyle = computed(() => {
  const style = { "--sketch-ratio": ratioValue.value };
  if (interfaceFullscreen.value || !effectiveControlsOutside.value) return style;

  const isNarrow = viewport.value.width <= 720;
  const outsideWidth = isNarrow ? 0 : 128;
  const outsideHeight = 104;
  const canvasWidth = Math.min(
    760,
    viewport.value.width - 32 - outsideWidth,
    (viewport.value.height - 32 - outsideHeight) * ratioValue.value,
  );
  return {
    ...style,
    width: `${canvasWidth}px`,
  };
});

const canvasCursor = computed(() => {
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
    fontSize: `${displaySize(command)}px`,
    lineHeight: textLineHeight,
  };
});

const { undoStack, redoStack, canUndo, canRedo, clone, pushHistory, undo, redo } = useHistory(
  () => commands.value,
  (restored, message, context) => {
    commands.value = restored;
    if (context?.backgroundColor) backgroundColor.value = context.backgroundColor;
    selectedIndex.value = -1;
    selectionCursor.value = "default";
    render();
    announce(message);
  },
  () => render(),
  () => ({ backgroundColor: backgroundColor.value }),
);
let controls;
const displaySize = (command) => command.worldSize ? camera.value.toScreenDistance(command.size) : command.size;
const { textLayout, textEditorBounds, startText, beginTextEdit, commitText, cancelText, resizeTextCommand, startTextTransform, moveTextTransform, finishTextTransform } = useSketchTextEditor({ commands, selectedIndex, activeTool, strokeColor, selectionCursor, textEditor, textValue, clone, pushHistory, announce, render, selectCommand: (...args) => controls.selectCommand(...args), normalizePoint, pixelPoint, eventPoint, getStageSize: () => stageSize, getContext: () => committedContext, input: textInput, getCamera: () => camera.value, displaySize });
controls = useSketchControls({ state: { activeTool, activeShape, strokeColor, strokeSize, commands, selectedIndex, activePopover, controlsOutside, canvasRatio, textEditor, selectionCursor, selectedCommand }, clone, pushHistory, render, resizeCanvases, announce, commitText, onRatioChange: changeCanvasRatio, getViewScale: () => camera.value.scale });
const { selectTool, toggleShapeMenu, toggleControlsOutside, toggleRatioMenu, selectShape, selectCommand, setStrokeSize, setStrokeColor } = controls;
const { commandBounds, geometryBounds, selectionBounds, findResizeHandle, resizeBounds, findCommand, drawSelection } = useSketchSelection({ commands, selectedIndex, pixelPoint, textLayout, displaySize });

function waitForCanvasTransition() {
  return new Promise((resolve) => {
    const element = dialog.value;
    if (!element) { resolve(); return; }
    let timer;
    const finish = () => {
      clearTimeout(timer);
      element.removeEventListener("transitionend", onTransitionEnd);
      resolve();
    };
    const onTransitionEnd = (event) => {
      if (event.target === element && ["width", "aspect-ratio"].includes(event.propertyName)) finish();
    };
    element.addEventListener("transitionend", onTransitionEnd);
    timer = setTimeout(finish, 240);
  });
}

async function changeCanvasRatio(ratio) {
  if (ratio === canvasRatio.value) return;
  canvasRatio.value = ratio;
  if (!commands.value.length) drawingRatio.value = ratioValue.value;
  closePopover();
  await nextTick();
  await waitForCanvasTransition();
  resizeCanvases();
  announce(`画布比例 ${ratio}`);
}

async function toggleInterfaceFullscreen() {
  interfaceFullscreen.value = !interfaceFullscreen.value;
  closePopover();
  await nextTick();
  await waitForCanvasTransition();
  resizeCanvases();
}

async function toggleBrowserFullscreen() {
  try {
    browserFullscreenTransition = true;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    announce("当前环境不支持浏览器全屏");
  }
}

async function syncBrowserFullscreen() {
  browserFullscreen.value = Boolean(document.fullscreenElement);
  if (!browserFullscreenTransition) return;
  browserFullscreenTransition = null;
  await nextTick();
  await waitForCanvasTransition();
  resizeCanvases();
}

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

function migrateLegacyCommands() {
  const activeCamera = camera.value;
  commands.value.forEach((command) => {
    if (command.worldSize) return;
    const toWorld = (point) => activeCamera.toWorld({ x: point.x * stageSize.width, y: point.y * stageSize.height, pressure: point.pressure });
    if (command.type === "text") {
      const point = toWorld(command);
      command.x = point.x;
      command.y = point.y;
      command.width = activeCamera.toWorldXDistance((command.width || 0) * stageSize.width);
    } else if (command.type === "shape") {
      command.start = toWorld(command.start);
      command.end = toWorld(command.end);
    } else {
      command.points = command.points.map(toWorld);
    }
    command.size = activeCamera.toWorldDistance(command.size);
    command.worldSize = true;
  });
}

function drawCommand(context, command, preview = false) {
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
    context.save();
    context.fillStyle = command.color;
    context.font = `600 ${displaySize(command)}px Inter, sans-serif`;
    context.textBaseline = "top";
    layout.lines.forEach((line, index) => {
      context.fillText(line, point.x, point.y + index * layout.lineHeight, layout.width);
    });
    context.restore();
  }
}

function clearContext(context, canvas) {
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function paintCanvasBackground(context, canvas) {
  context.save();
  context.fillStyle = canvasBackgroundColor.value;
  context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  context.restore();
}

function render() {
  if (!committedContext || !liveContext || !committedCanvas.value || !liveCanvas.value) return;
  migrateLegacyCommands();
  clearContext(committedContext, committedCanvas.value);
  paintCanvasBackground(committedContext, committedCanvas.value);
  clearContext(liveContext, liveCanvas.value);
  commands.value.forEach((command) => drawCommand(committedContext, command));
  if (!textEditor.value) drawSelection(liveContext);
}

function renderLive(command) {
  clearContext(liveContext, liveCanvas.value);
  drawCommand(liveContext, command, true);
}

function renderEraserPreview(command) {
  clearContext(committedContext, committedCanvas.value);
  paintCanvasBackground(committedContext, committedCanvas.value);
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
  stageRevision.value += 1;
  const dpr = window.devicePixelRatio || 1;
  [committedCanvas.value, liveCanvas.value].forEach((canvas) => {
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  });
  prepareContext(committedContext);
  prepareContext(liveContext);
  render();
}

function updateViewport() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
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

function resizeCommand(command, point, gestureState) {
  const handle = gestureState.handle;
  const normalized = normalizePoint(point);

  if (command.type === "shape" && ["line", "arrow"].includes(command.shape)) {
    command[handle.id] = normalized;
    return;
  }

  if (command.type === "shape") {
    const padding = displaySize(command) / 2 + 1;
    const targetSelection = resizeBounds(gestureState.originalSelectionBounds, handle.id, point);
    const left = Math.min(targetSelection.x, targetSelection.x + targetSelection.width) + padding;
    const right = Math.max(targetSelection.x, targetSelection.x + targetSelection.width) - padding;
    const top = Math.min(targetSelection.y, targetSelection.y + targetSelection.height) + padding;
    const bottom = Math.max(targetSelection.y, targetSelection.y + targetSelection.height) - padding;
    command.start = normalizePoint({ x: left, y: top });
    command.end = normalizePoint({ x: right, y: bottom });
    return;
  }

  if (command.type === "text") {
    resizeTextCommand(command, point, gestureState);
    return;
  }

  if (command.type === "pen") {
    const originalBounds = gestureState.originalBounds;
    const padding = displaySize(command) / 2 + 1;
    const targetSelection = resizeBounds(gestureState.originalSelectionBounds, handle.id, point);
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
  }
}

function updatePointerCursor(point, visible = true) {
  pointerCursor.value = { x: point.x, y: point.y, visible };
}

function isPointInCanvas(point) {
  return point.x >= 0 && point.y >= 0 && point.x <= stageSize.width && point.y <= stageSize.height;
}

const { onPointerDown, onCanvasDoubleClick, onPointerMove, finishPointer, onCanvasLeave } = useSketchPointer({
  activeTool, activeShape, strokeColor, strokeSize, activePopover, commands, selectedIndex, selectedCommand, selectionCursor,
  pointerCursor, clone, pushHistory, announce, selectCommand, findResizeHandle, findCommand, selectionBounds, geometryBounds,
  resizeCommand, translateCommand, normalizePoint, pixelPoint, eventPoint, render, renderLive, renderEraserPreview, startText,
  beginTextEdit, updatePointerCursor, isPointInCanvas, getResizeCursor, hitSelectionFrame, getViewScale: () => camera.value.scale,
});

function cancelWindowPointer(event) {
  finishPointer(event, true);
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
  announce("画布已清空");
}

async function copyCanvas() {
  if (!hasContent.value || !navigator.clipboard || typeof ClipboardItem === "undefined") {
    announce("当前环境不支持复制 PNG");
    return;
  }
  const output = document.createElement("canvas");
  output.width = committedCanvas.value.width;
  output.height = committedCanvas.value.height;
  const context = output.getContext("2d");
  context.fillStyle = canvasBackgroundColor.value;
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(committedCanvas.value, 0, 0);
  output.toBlob(async (blob) => {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copySucceeded.value = true;
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = setTimeout(() => { copySucceeded.value = false; }, 1600);
      announce("PNG 图片已复制");
    } catch {
      copySucceeded.value = false;
      announce("复制 PNG 失败");
    }
  }, "image/png");
}

function requestClearCanvas(anchor) {
  if (activePopover.value === "clear") closePopover();
  else openPopover("clear", anchor, { confirm: confirmClearCanvas, cancel: closePopover });
}

function toggleBackgroundMenu(anchor) {
  if (activePopover.value === "background") closePopover();
  else openPopover("background", anchor, { preview: previewBackgroundColor, select: setBackgroundColor }, { get current() { return backgroundColor.value; } });
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
  announce("画布背景色已更新");
}

function downloadCanvas() {
  const output = document.createElement("canvas");
  output.width = committedCanvas.value.width;
  output.height = committedCanvas.value.height;
  const context = output.getContext("2d");
  context.fillStyle = backgroundColor.value;
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(committedCanvas.value, 0, 0);

  const link = document.createElement("a");
  link.download = `sketch-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = output.toDataURL("image/png");
  link.click();
  emit("download", link.download);
  announce("图片已下载");
}

function closeDialog() {
  emit("update:modelValue", false);
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
    pushHistory(previous);
    announce("对象已删除");
  }
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    await nextTick();
    if (!dialog.value) return;
    if (isOpen) {
      await nextTick();
      resizeCanvases();
      liveCanvas.value.focus();
    }
  },
);

watch(strokeSize, (size) => announce(`画笔粗细 ${size} 像素`));
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
  drawingRatio.value = ratioValue.value;
  committedContext = committedCanvas.value.getContext("2d");
  liveContext = liveCanvas.value.getContext("2d");
  resizeObserver = new ResizeObserver(() => {
    if (props.modelValue) resizeCanvases();
  });
  resizeObserver.observe(stage.value);
  window.addEventListener("resize", updateViewport);
  window.addEventListener("pointerup", finishPointer);
  window.addEventListener("pointercancel", cancelWindowPointer);
  document.addEventListener("fullscreenchange", syncBrowserFullscreen);
  if (props.modelValue) {
    nextTick(() => {
      resizeCanvases();
      liveCanvas.value.focus();
    });
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  clearTimeout(copyFeedbackTimer);
  window.removeEventListener("resize", updateViewport);
  window.removeEventListener("pointerup", finishPointer);
  window.removeEventListener("pointercancel", cancelWindowPointer);
  document.removeEventListener("fullscreenchange", syncBrowserFullscreen);
});
</script>

<template>
  <Teleport to="body">
    <div v-show="modelValue" class="sketch-modal" :class="{ 'is-interface-fullscreen': interfaceFullscreen }">
      <div class="sketch-backdrop"></div>
      <div ref="dialog" class="sketch-dialog" :style="dialogStyle" role="dialog" aria-modal="true" aria-labelledby="sketch-dialog-title" tabindex="-1" @keydown="onKeydown">
      <section class="sketch-editor" :class="{ 'is-controls-outside': effectiveControlsOutside }">
          <h2 id="sketch-dialog-title" class="sr-only">{{ copy.labels.dialog }}</h2>
        <div id="sketch-popover-host"></div>

        <SketchToolbar
          :active-tool="activeTool"
          :active-shape="activeShape"
          :shape-menu-open="activePopover === 'shape'"
          :can-undo="canUndo"
          :can-redo="canRedo"
          :can-copy="hasContent"
          :copy-succeeded="copySucceeded"
          :is-fullscreen="isFullscreen"
          :is-browser-fullscreen="browserFullscreen"
          :is-interface-fullscreen="interfaceFullscreen"
          :has-content="hasContent"
          :controls-outside="effectiveControlsOutside"
          @close="closeDialog"
          @select-tool="selectTool"
          @toggle-shapes="toggleShapeMenu"
          @select-shape="selectShape"
          @undo="undo"
          @copy="copyCanvas"
          @redo="redo"
          @clear="requestClearCanvas"
          @toggle-controls="toggleControlsOutside"
          @toggle-ratio="toggleRatioMenu"
          @toggle-background="toggleBackgroundMenu"
          @toggle-browser-fullscreen="toggleBrowserFullscreen"
          @toggle-interface-fullscreen="toggleInterfaceFullscreen"
          @close-popover="closePopover"
        />


        <div class="sketch-body">
          <div ref="stage" class="sketch-stage" :style="{ backgroundColor: canvasBackgroundColor }">
            <canvas ref="committedCanvas" class="committed-canvas" aria-hidden="true"></canvas>
            <canvas
              ref="liveCanvas"
              class="live-canvas"
              role="application"
              :aria-label="copy.labels.canvas"
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

          <SketchTextEditor
            v-if="textEditor"
            ref="textInput"
            v-model="textValue"
            class="canvas-text-editor"
            :style="textEditorStyle"
            @transform-start="startTextTransform"
            @transform-move="moveTextTransform"
            @transform-end="finishTextTransform"
            @cancel="cancelText"
            @commit="commitText"
          />

          </div>
        </div>
        <ColorPalette :model-value="strokeColor" :disabled="!hasContent" :can-copy="hasContent" :copy-succeeded="copySucceeded" :outside="effectiveControlsOutside" @update:model-value="setStrokeColor" @download="downloadCanvas" @copy="copyCanvas" />
        <StrokeSizeControl :model-value="strokeSize" :outside="effectiveControlsOutside" @update:model-value="setStrokeSize" />
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
