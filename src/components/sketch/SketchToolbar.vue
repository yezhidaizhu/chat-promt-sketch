<script setup>
import { BrushCleaning, ChevronsDown, ChevronsUp, Eraser, Fullscreen, ImagePlus, LoaderCircle, Minimize, MousePointer2, PaintBucket, Ratio, Redo2, Type, Undo2, X } from "@lucide/vue";
import { ref } from "vue";
import PopoverTrigger from "../PopoverTrigger.vue";
import ShapePicker from "./ShapePicker.vue";
import MoveControlsIcon from "./MoveControlsIcon.vue";
import SketchControlPill from "./SketchControlPill.vue";
import SketchToolIcon from "./SketchToolIcon.vue";
import { sketchConfig } from "../../config/sketch.js";
import { locale } from "../../locales/index.js";

defineProps({
  activeTool: {
    type: String,
    required: true,
  },
  activeShape: {
    type: String,
    required: true,
  },
  shapeMenuOpen: Boolean,
  canUndo: Boolean,
  canRedo: Boolean,
  isFullscreen: Boolean,
  isBrowserFullscreen: Boolean,
  hasContent: Boolean,
  controlsOutside: Boolean,
  zoomPercent: { type: Number, required: true },
  activePopover: String,
  imageLoading: Boolean,
  embedded: Boolean,
});

const emit = defineEmits([
  "close",
  "select-tool",
  "toggle-shapes",
  "select-shape",
  "undo",
  "redo",
  "clear",
  "toggle-controls",
  "toggle-background",
  "toggle-ratio",
  "toggle-browser-fullscreen",
  "toggle-view",
  "add-image",
  "close-popover",
]);

const moreExpanded = ref(false);

function toggleMore() {
  moreExpanded.value = !moreExpanded.value;
  emit("close-popover");
}

function selectMoreAction(anchor, action) {
  emit(action, anchor);
}

function requestImage() {
  moreExpanded.value = false;
  emit("close-popover");
  emit("add-image");
}

const copy = locale.sketch;
const toolIcons = { select: MousePointer2, pen: SketchToolIcon, text: Type };
const tools = sketchConfig.tools.filter((tool) => tool !== "eraser").map((id) => ({ id, label: copy.tools[id], icon: toolIcons[id] }));
const toolLabels = copy.tools;
</script>

<template>
  <header class="editor-header" :class="{ 'is-outside': controlsOutside, 'is-embedded': embedded }">
    <button v-if="!embedded" class="icon-button close-button" type="button" :title="copy.labels.close" :aria-label="copy.labels.closeDialog" @click="emit('close')">
      <X :size="21" aria-hidden="true" />
    </button>

    <SketchControlPill class="tool-group" role="toolbar" aria-label="Drawing tools">
      <button
        v-for="tool in tools"
        :key="tool.id"
        class="tool-button"
        :class="{ 'is-active': activeTool === tool.id }"
        type="button"
        :title="tool.label"
        :aria-label="tool.label"
        :aria-pressed="activeTool === tool.id"
        @click="emit('select-tool', tool.id)"
      >
        <component :is="tool.icon" :size="20" aria-hidden="true" />
      </button>

      <button class="tool-button" type="button" :title="copy.labels.addImage" :aria-label="copy.labels.addImage" :aria-busy="imageLoading" :disabled="imageLoading" @click="requestImage">
        <LoaderCircle v-if="imageLoading" class="is-spinning" :size="20" aria-hidden="true" />
        <ImagePlus v-else :size="20" aria-hidden="true" />
      </button>

      <ShapePicker
        :active="activeTool === 'shape'"
        :active-shape="activeShape"
        :open="shapeMenuOpen"
        @toggle="emit('toggle-shapes', $event)"
        @select="emit('select-shape', $event)"
      />

      <button
        class="tool-button"
        :class="{ 'is-active': activeTool === 'eraser' }"
        type="button"
        :title="toolLabels.eraser"
        :aria-label="toolLabels.eraser"
        :aria-pressed="activeTool === 'eraser'"
        @click="emit('select-tool', 'eraser')"
      >
        <Eraser :size="20" aria-hidden="true" />
      </button>
    </SketchControlPill>

    <div class="action-group" role="group" :aria-label="copy.labels.canvasActions">
      <button class="icon-button" type="button" :title="copy.labels.undo" aria-label="Undo" :disabled="!canUndo" @click="emit('undo')">
        <Undo2 :size="20" aria-hidden="true" />
      </button>
      <button class="icon-button" type="button" :title="copy.labels.redo" aria-label="Redo" :disabled="!canRedo" @click="emit('redo')">
        <Redo2 :size="20" aria-hidden="true" />
      </button>
      <PopoverTrigger class="icon-button" :label="copy.labels.clearCanvas" :open="activePopover === 'clear'" :disabled="!hasContent" @toggle="emit('clear', $event)">
        <BrushCleaning :size="19" aria-hidden="true" />
      </PopoverTrigger>
      <div class="settings-stack" :class="{ 'is-expanded': moreExpanded }">
        <button v-if="!moreExpanded" class="icon-button more-toggle" type="button" :title="copy.labels.expandSettings" :aria-label="copy.labels.expandSettings" aria-haspopup="menu" :aria-expanded="moreExpanded" @click="toggleMore">
          <ChevronsDown :size="20" aria-hidden="true" />
        </button>
        <div v-else class="canvas-settings-menu" role="menu" :aria-label="copy.labels.canvasSettings">
          <button class="more-toggle" type="button" :title="copy.labels.collapseSettings" :aria-label="copy.labels.collapseSettings" @click="toggleMore"><ChevronsUp :size="20" aria-hidden="true" /></button>
          <PopoverTrigger class="zoom-summary" :class="{ 'is-active': activePopover === 'view' }" role="menuitem" :title="copy.labels.viewControls" :label="`${copy.labels.viewControls}: ${zoomPercent}%`" :open="activePopover === 'view'" @toggle="selectMoreAction($event, 'toggle-view')">{{ zoomPercent }}%</PopoverTrigger>
          <PopoverTrigger role="menuitem" :label="copy.labels.background" :open="activePopover === 'background'" @toggle="selectMoreAction($event, 'toggle-background')"><PaintBucket :size="18" aria-hidden="true" /></PopoverTrigger>
          <PopoverTrigger role="menuitem" :label="copy.labels.ratio" :open="activePopover === 'ratio'" @toggle="selectMoreAction($event, 'toggle-ratio')"><Ratio :size="18" aria-hidden="true" /></PopoverTrigger>
          <button type="button" role="menuitem" :title="controlsOutside ? copy.labels.moveControlsInside : copy.labels.moveControlsOutside" :aria-label="controlsOutside ? copy.labels.moveControlsInside : copy.labels.moveControlsOutside" :disabled="isFullscreen" @click="selectMoreAction($event, 'toggle-controls')"><MoveControlsIcon :outside="controlsOutside" /></button>
          <button type="button" role="menuitem" :title="isBrowserFullscreen ? copy.labels.exitBrowserFullscreen : copy.labels.browserFullscreen" :aria-label="isBrowserFullscreen ? copy.labels.exitBrowserFullscreen : copy.labels.browserFullscreen" @click="emit('toggle-browser-fullscreen')"><Minimize v-if="isBrowserFullscreen" :size="18" aria-hidden="true" /><Fullscreen v-else :size="18" aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.editor-header {
  position: absolute;
  z-index: var(--sketch-z-controls);
  top: var(--sketch-space-2);
  right: var(--sketch-space-3);
  left: var(--sketch-space-3);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  pointer-events: none;
  transition: top var(--sketch-transition-expand);
}

.editor-header.is-outside {
  top: calc(-1 * (var(--sketch-control-size) + var(--sketch-space-1) * 2 + var(--sketch-space-3)));
}

.editor-header button,
.action-group {
  pointer-events: auto;
}

.tool-group,
.action-group {
  display: flex;
  align-items: center;
}

.tool-group {
  --toolbar-control-size: var(--sketch-control-size);
  width: calc(var(--toolbar-control-size) * 6 + 10px + var(--sketch-space-1) * 2);
  min-width: 0;
}

.shape-picker,
.tool-group > .tool-button {
  flex: 0 0 var(--toolbar-control-size);
}

.editor-header.is-outside .tool-group {
  background: var(--sketch-color-control);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.action-group {
  position: relative;
  justify-self: end;
  gap: var(--sketch-space-2);
}

.settings-stack {
  position: relative;
  width: calc(var(--sketch-control-size) + var(--sketch-space-1) * 2 + 2px);
  height: calc(var(--sketch-control-size) + var(--sketch-space-1) * 2 + 2px);
  flex: 0 0 auto;
}

.settings-stack > .more-toggle {
  position: absolute;
  top: var(--sketch-space-1);
  right: var(--sketch-space-1);
}

.canvas-settings-menu {
  position: absolute;
  top: 0;
  right: 0;
  z-index: var(--sketch-z-popover);
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 2px;
  padding: var(--sketch-space-1);
  border: 1px solid var(--sketch-color-border);
  border-radius: var(--sketch-radius-pill);
  background: rgba(27, 27, 27, 0.62);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  backdrop-filter: blur(12px) saturate(120%);
  animation: settings-expand var(--sketch-transition-expand);
  transform-origin: top;
}

.canvas-settings-menu button {
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
}

.canvas-settings-menu button:hover:not(:disabled) {
  background: var(--sketch-color-control-hover);
  color: var(--sketch-color-text);
}

.canvas-settings-menu button.is-active {
  background: var(--sketch-color-control-active);
  color: var(--sketch-color-text);
}

.zoom-summary {
  font: 600 11px/1 var(--font-ui);
  font-variant-numeric: tabular-nums;
}

.canvas-settings-menu button:disabled {
  opacity: 0.3;
  cursor: default;
}

.canvas-settings-menu button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}


.more-toggle {
  background: #000000;
  color: var(--sketch-color-text);
}

.more-toggle:hover:not(:disabled) {
  background: #000000;
  color: var(--sketch-color-text);
}

@keyframes settings-expand {
  from {
    opacity: 0;
    transform: scaleY(0.7);
  }
  to {
    opacity: 1;
    transform: scaleY(1);
  }
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
  transition: color var(--sketch-transition-fast), background-color var(--sketch-transition-fast), box-shadow var(--sketch-transition-fast), opacity var(--sketch-transition-fast);
}

.icon-button:hover:not(:disabled),
.tool-button:hover:not(:disabled),
.tool-button.is-active:hover {
  background: var(--sketch-color-control-hover);
  color: var(--sketch-color-text);
}

.icon-button.is-active {
  background: var(--sketch-color-control-active);
  color: var(--sketch-color-text);
}

.tool-button.is-active {
  background: var(--sketch-color-control-active);
  color: var(--sketch-color-text);
}

.is-spinning {
  animation: image-loading 800ms linear infinite;
}

@keyframes image-loading {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .is-spinning { animation: none; }
}

.icon-button:disabled,
.tool-button:disabled {
  opacity: 0.3;
  cursor: default;
}

.icon-button:focus-visible,
.tool-button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

@container (max-width: 500px) {
  .editor-header.is-outside:not(.is-embedded) {
    right: auto;
    left: 50%;
    display: flex;
    width: calc(100vw - var(--sketch-space-2) * 2);
    justify-content: center;
    column-gap: var(--sketch-space-2);
    transform: translateX(calc(-50% - var(--sketch-outside-offset-x, 0px)));
  }

  .editor-header.is-outside:not(.is-embedded) .close-button,
  .editor-header.is-outside:not(.is-embedded) .tool-group,
  .editor-header.is-outside:not(.is-embedded) .action-group {
    flex: 0 0 auto;
  }
}


@media (max-width: 640px) {
  .editor-header {
    top: var(--sketch-space-2);
    right: var(--sketch-space-2);
    left: var(--sketch-space-2);
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: var(--sketch-space-2);
  }

  .editor-header.is-outside {
    top: calc(-1 * (var(--sketch-control-size) + var(--sketch-space-1) * 2 + var(--sketch-space-3)));
  }

  .close-button {
    justify-self: start;
  }

  .action-group {
    grid-column: 3;
    grid-row: 1;
  }

  .tool-group {
    grid-column: 2;
    grid-row: 1;
    justify-self: start;
  }

}

@media (max-width: 420px) {
  .tool-group {
    --toolbar-control-size: 26px;
    gap: 0;
    padding: 2px;
  }
}

@media (max-width: 360px) {
  .editor-header {
    right: 6px;
    left: 6px;
    column-gap: 2px;
  }

  .tool-group {
    --toolbar-control-size: 24px;
    gap: 0;
    padding: 2px;
  }

  .action-group {
    gap: 2px;
  }

  .icon-button,
  .tool-button {
    width: 28px;
    height: 28px;
  }
}

@container (max-width: 420px) {
  .editor-header.is-outside:not(.is-embedded) .tool-group {
    --toolbar-control-size: var(--sketch-control-size);
    width: auto;
    flex: 1 1 auto;
    justify-content: flex-start;
    gap: 2px;
    padding: var(--sketch-space-1);
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: none;
    touch-action: pan-x;
  }

  .editor-header.is-outside:not(.is-embedded) .tool-group::-webkit-scrollbar {
    display: none;
  }

  .editor-header.is-outside:not(.is-embedded) .action-group {
    gap: var(--sketch-space-2);
  }

  .editor-header.is-outside:not(.is-embedded) .icon-button,
  .editor-header.is-outside:not(.is-embedded) .tool-button {
    width: var(--sketch-control-size);
    height: var(--sketch-control-size);
  }
}

.editor-header.is-embedded {
  right: var(--sketch-space-2);
  left: var(--sketch-space-2);
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--sketch-space-2);
}

.editor-header.is-embedded .tool-group {
  grid-column: 1;
  grid-row: 1;
  justify-self: start;
}

.editor-header.is-embedded .action-group {
  grid-column: 2;
  grid-row: 1;
}
</style>
