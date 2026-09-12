<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ColorPalette from "./ColorPalette.vue";
import SketchToolbar from "./SketchToolbar.vue";
import StrokeSizeControl from "./StrokeSizeControl.vue";
import PopoverHost from "./PopoverHost.vue";
import ShapeMenu from "./ShapeMenu.vue";
import RatioMenu from "./RatioMenu.vue";
import SketchTextEditor from "./SketchTextEditor.vue";
import { useHistory } from "../../composables/useHistory.js";
import { useSketchState } from "../../composables/useSketchState.js";
import { useSketchControls } from "../../composables/useSketchControls.js";
import { useSketchPointer } from "../../composables/useSketchPointer.js";
import { useSketchSelection } from "../../composables/useSketchSelection.js";
import { useSketchTextEditor } from "../../composables/useSketchTextEditor.js";
import { isSelectionFrameHit as hitSelectionFrame, resizeCursor as getResizeCursor } from "../../utils/hitTest.js";
import { drawFreehand, drawShape, prepareContext } from "../../utils/sketchDrawing.js";

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
  activeTool, activeShape, strokeColor, strokeSize, commands, selectedIndex,
  activePopover, popoverAnchor, controlsOutside, canvasRatio, textEditor,
  textValue, selectionCursor, selectedCommand, hasContent,
} = useSketchState();
const pointerCursor = ref({ x: 0, y: 0, visible: false });
const statusMessage = ref("");
const viewport = ref({ width: window.innerWidth, height: window.innerHeight });

let committedContext;
let liveContext;
let stageSize = { width: 1, height: 1 };
let textTransform = null;
let resizeObserver;

const textEditorPadding = 6;
const textEditorMinWidth = 48;
const textEditorDefaultWidth = 240;
const textLineHeight = 1.25;
const textMinSize = 12;
const textMaxSize = 160;

const toolLabels = { select: "选择并移动", pen: "画笔", text: "文字", eraser: "橡皮擦" };
const ratioValue = computed(() => {
  const [width, height] = canvasRatio.value.split(":").map(Number);
  return width / height;
});
const dialogStyle = computed(() => {
  const style = { "--sketch-ratio": ratioValue.value };
  if (!controlsOutside.value) return style;

  const canvasWidth = Math.min(
    760,
    viewport.value.width - 32,
    (viewport.value.height - 32) * ratioValue.value,
  );
  const canvasHeight = canvasWidth / ratioValue.value;
  const scale = Math.min(
    1,
    (viewport.value.width - 32) / (canvasWidth + 60),
    (viewport.value.height - 32) / (canvasHeight + 104),
  );
  return { ...style, "--sketch-outside-scale": scale };
});

const canvasCursor = computed(() => {
  if (activeTool.value === "select") return selectedIndex.value >= 0 ? selectionCursor.value : "default";
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

const { undoStack, redoStack, canUndo, canRedo, clone, pushHistory, undo, redo } = useHistory(
  () => commands.value,
  (restored, message) => {
    commands.value = restored;
    selectedIndex.value = -1;
    selectionCursor.value = "default";
    render();
    announce(message);
  },
  () => render(),
);
let controls;
const { textLayout, textEditorBounds, startText, beginTextEdit, commitText, cancelText, resizeTextCommand, startTextTransform, moveTextTransform, finishTextTransform } = useSketchTextEditor({ commands, selectedIndex, activeTool, strokeColor, selectionCursor, textEditor, textValue, clone, pushHistory, announce, render, selectCommand: (...args) => controls.selectCommand(...args), normalizePoint, pixelPoint, eventPoint, getStageSize: () => stageSize, getContext: () => committedContext, input: textInput });
controls = useSketchControls({ state: { activeTool, activeShape, strokeColor, strokeSize, commands, selectedIndex, activePopover, popoverAnchor, controlsOutside, canvasRatio, textEditor, selectionCursor, selectedCommand }, clone, pushHistory, render, resizeCanvases, announce, commitText });
const { selectTool, toggleShapeMenu, toggleControlsOutside, toggleRatioMenu, selectCanvasRatio, selectShape, selectCommand, setStrokeSize, setStrokeColor } = controls;
const { commandBounds, geometryBounds, selectionBounds, findResizeHandle, resizeBounds, findCommand, drawSelection } = useSketchSelection({ commands, selectedIndex, pixelPoint, textLayout });

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

function drawCommand(context, command, preview = false) {
  if (["pen", "eraser"].includes(command.type)) {
    drawFreehand(context, command, pixelPoint, preview);
    return;
  }
  if (command.type === "shape") {
    drawShape(context, command, pixelPoint);
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

function clearContext(context, canvas) {
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function render() {
  if (!committedContext || !liveContext || !committedCanvas.value || !liveCanvas.value) return;
  clearContext(committedContext, committedCanvas.value);
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
    const padding = command.size / 2 + 1;
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
    const padding = command.size / 2 + 1;
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

const { onPointerDown, onCanvasDoubleClick, onPointerMove, finishPointer, onCanvasLeave } = useSketchPointer({
  activeTool, activeShape, strokeColor, strokeSize, activePopover, commands, selectedIndex, selectedCommand, selectionCursor,
  pointerCursor, clone, pushHistory, announce, selectCommand, findResizeHandle, findCommand, selectionBounds, geometryBounds,
  resizeCommand, translateCommand, normalizePoint, pixelPoint, eventPoint, render, renderLive, renderEraserPreview, startText,
  beginTextEdit, updatePointerCursor, getResizeCursor, hitSelectionFrame,
});

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
  window.addEventListener("resize", updateViewport);
  if (props.modelValue) {
    dialog.value.showModal();
    nextTick(() => {
      resizeCanvases();
      liveCanvas.value.focus();
    });
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", updateViewport);
});
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="sketch-dialog"
      :style="dialogStyle"
      aria-labelledby="sketch-dialog-title"
      @cancel="onCancel"
      @keydown="onKeydown"
    >
      <section class="sketch-editor" :class="{ 'is-controls-outside': controlsOutside }">
        <h2 id="sketch-dialog-title" class="sr-only">画板</h2>

        <SketchToolbar
          :active-tool="activeTool"
          :active-shape="activeShape"
          :shape-menu-open="activePopover === 'shape'"
          :can-undo="canUndo"
          :can-redo="canRedo"
          :has-content="hasContent"
          :controls-outside="controlsOutside"
          :ratio="canvasRatio"
          :ratio-menu-open="activePopover === 'ratio'"
          @close="closeDialog"
          @select-tool="selectTool"
          @toggle-shapes="toggleShapeMenu"
          @select-shape="selectShape"
          @undo="undo"
          @redo="redo"
          @clear="clearCanvas"
          @toggle-controls="toggleControlsOutside"
          @toggle-ratio="toggleRatioMenu"
          @select-ratio="selectCanvasRatio"
        />

        <PopoverHost :open="Boolean(activePopover)" :anchor="popoverAnchor" @close="activePopover = null">
          <ShapeMenu v-if="activePopover === 'shape'" :active-shape="activeShape" @select="selectShape" />
          <RatioMenu v-else-if="activePopover === 'ratio'" :current="canvasRatio" @select="selectCanvasRatio" />
        </PopoverHost>

        <div class="sketch-body">
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
        <ColorPalette :model-value="strokeColor" :disabled="!hasContent" :outside="controlsOutside" @update:model-value="setStrokeColor" @finish="finishSketch" />
        <StrokeSizeControl :model-value="strokeSize" :outside="controlsOutside" @update:model-value="setStrokeSize" />
        <div class="sr-only" aria-live="polite">{{ statusMessage }}</div>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.sketch-dialog {
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
  transform: scale(var(--sketch-outside-scale, 1));
  transition: width var(--sketch-transition-expand), aspect-ratio var(--sketch-transition-expand), transform var(--sketch-transition-expand);
}

.sketch-dialog::backdrop {
  background: var(--sketch-color-backdrop);
  backdrop-filter: blur(3px);
}

.sketch-dialog[open] {
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
    transform: translateY(8px) scale(calc(var(--sketch-outside-scale, 1) * 0.98));
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(var(--sketch-outside-scale, 1));
  }
}

@media (max-width: 640px) {
  .sketch-dialog {
    width: min(calc(100vw - 16px), calc((100dvh - 16px) * var(--sketch-ratio)));
  }

}
</style>
