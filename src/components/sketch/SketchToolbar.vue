<script setup>
import { BrushCleaning, ChevronsDown, ChevronsUp, Eraser, Fullscreen, Hand, Maximize2, Minimize, Minimize2, Minus, MousePointer2, PaintBucket, Plus, Ratio, Redo2, Type, Undo2, X } from "@lucide/vue";
import { ref } from "vue";
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
  isInterfaceFullscreen: Boolean,
  hasContent: Boolean,
  controlsOutside: Boolean,
  zoomPercent: { type: Number, required: true },
  panActive: Boolean,
  canZoomIn: Boolean,
  canZoomOut: Boolean,
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
  "toggle-interface-fullscreen",
  "toggle-pan",
  "zoom-in",
  "zoom-out",
  "reset-view",
  "close-popover",
]);

const moreExpanded = ref(false);

function toggleMore() {
  moreExpanded.value = !moreExpanded.value;
  emit("close-popover");
}

function selectMoreAction(event, action) {
  emit(action, event.currentTarget);
}

const copy = locale.sketch;
const toolIcons = { select: MousePointer2, pen: SketchToolIcon, text: Type };
const tools = sketchConfig.tools.filter((tool) => tool !== "eraser").map((id) => ({ id, label: copy.tools[id], icon: toolIcons[id] }));
const toolLabels = copy.tools;
</script>

<template>
  <header class="editor-header" :class="{ 'is-outside': controlsOutside }">
    <button class="icon-button close-button" type="button" :title="copy.labels.close" :aria-label="copy.labels.closeDialog" @click="emit('close')">
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

      <!--
      <button class="tool-button" type="button" title="展开更多绘图工具" aria-label="展开更多绘图工具">
        <ChevronRight :size="20" aria-hidden="true" />
      </button>
      -->
    </SketchControlPill>

    <div class="action-group" role="group" :aria-label="copy.labels.canvasActions">
      <button class="icon-button" type="button" :title="copy.labels.undo" aria-label="Undo" :disabled="!canUndo" @click="emit('undo')">
        <Undo2 :size="20" aria-hidden="true" />
      </button>
      <button class="icon-button" type="button" :title="copy.labels.redo" aria-label="Redo" :disabled="!canRedo" @click="emit('redo')">
        <Redo2 :size="20" aria-hidden="true" />
      </button>
      <button class="icon-button" type="button" :title="copy.labels.clearCanvas" :aria-label="copy.labels.clearCanvas" aria-haspopup="menu" :disabled="!hasContent" @click="emit('clear', $event.currentTarget)">
        <BrushCleaning :size="19" aria-hidden="true" />
      </button>
      <div class="settings-stack" :class="{ 'is-expanded': moreExpanded }">
        <button v-if="!moreExpanded" class="icon-button more-toggle" type="button" :title="copy.labels.expandSettings" :aria-label="copy.labels.expandSettings" aria-haspopup="menu" :aria-expanded="moreExpanded" @click="toggleMore">
          <ChevronsDown :size="20" aria-hidden="true" />
        </button>
        <div v-else class="canvas-settings-menu" role="menu" :aria-label="copy.labels.canvasSettings">
          <button class="more-toggle" type="button" :title="copy.labels.collapseSettings" :aria-label="copy.labels.collapseSettings" @click="toggleMore"><ChevronsUp :size="20" aria-hidden="true" /></button>
          <div class="view-settings-row" role="group" :aria-label="copy.labels.viewControls">
            <button type="button" role="menuitemcheckbox" :class="{ 'is-active': panActive }" :title="copy.labels.panCanvas" :aria-label="copy.labels.panCanvas" :aria-checked="panActive" @click="emit('toggle-pan')"><Hand :size="18" aria-hidden="true" /></button>
            <button type="button" role="menuitem" :title="copy.labels.zoomOut" :aria-label="copy.labels.zoomOut" :disabled="!canZoomOut" @click="emit('zoom-out')"><Minus :size="18" aria-hidden="true" /></button>
            <button class="zoom-value" type="button" role="menuitem" :title="copy.labels.resetView" :aria-label="`${copy.labels.resetView}: ${zoomPercent}%`" @click="emit('reset-view')">{{ zoomPercent }}%</button>
            <button type="button" role="menuitem" :title="copy.labels.zoomIn" :aria-label="copy.labels.zoomIn" :disabled="!canZoomIn" @click="emit('zoom-in')"><Plus :size="18" aria-hidden="true" /></button>
          </div>
          <button type="button" role="menuitem" :title="copy.labels.background" :aria-label="copy.labels.background" aria-haspopup="menu" @click="selectMoreAction($event, 'toggle-background')"><PaintBucket :size="18" aria-hidden="true" /></button>
          <button type="button" role="menuitem" :title="copy.labels.ratio" :aria-label="copy.labels.ratio" :disabled="isFullscreen" @click="selectMoreAction($event, 'toggle-ratio')"><Ratio :size="18" aria-hidden="true" /></button>
          <button type="button" role="menuitem" :title="controlsOutside ? copy.labels.moveControlsInside : copy.labels.moveControlsOutside" :aria-label="controlsOutside ? copy.labels.moveControlsInside : copy.labels.moveControlsOutside" :disabled="isFullscreen" @click="selectMoreAction($event, 'toggle-controls')"><MoveControlsIcon :outside="controlsOutside" /></button>
          <button type="button" role="menuitem" :title="isBrowserFullscreen ? copy.labels.exitBrowserFullscreen : copy.labels.browserFullscreen" :aria-label="isBrowserFullscreen ? copy.labels.exitBrowserFullscreen : copy.labels.browserFullscreen" @click="emit('toggle-browser-fullscreen')"><Minimize v-if="isBrowserFullscreen" :size="18" aria-hidden="true" /><Fullscreen v-else :size="18" aria-hidden="true" /></button>
          <button type="button" role="menuitem" :title="isInterfaceFullscreen ? copy.labels.exitInterfaceFullscreen : copy.labels.interfaceFullscreen" :aria-label="isInterfaceFullscreen ? copy.labels.exitInterfaceFullscreen : copy.labels.interfaceFullscreen" @click="emit('toggle-interface-fullscreen')"><Minimize2 v-if="isInterfaceFullscreen" :size="18" aria-hidden="true" /><Maximize2 v-else :size="18" aria-hidden="true" /></button>
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
  width: calc(var(--toolbar-control-size) * 5 + 8px + var(--sketch-space-1) * 2);
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
  display: grid;
  grid-template-columns: 36px 36px 36px 44px 36px;
  align-items: flex-end;
  gap: 2px;
  padding: var(--sketch-space-1);
  border: 1px solid var(--sketch-color-border);
  border-radius: 24px;
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

.view-settings-row {
  display: grid;
  grid-column: 2 / -1;
  grid-template-columns: 36px 36px 44px 36px;
  align-items: center;
  gap: 2px;
}

.view-settings-row .zoom-value {
  width: 44px;
  border-radius: var(--sketch-radius-sm);
  font: 600 12px/1 var(--font-ui);
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

@media (pointer: coarse) {
  .canvas-settings-menu {
    grid-template-columns: 44px 44px 44px 52px 44px;
  }

  .canvas-settings-menu button {
    width: 44px;
    height: 44px;
  }

  .view-settings-row {
    grid-template-columns: 44px 44px 52px 44px;
  }

  .view-settings-row .zoom-value {
    width: 52px;
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
.tool-button:hover,
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

.icon-button:disabled {
  opacity: 0.3;
  cursor: default;
}

.icon-button:focus-visible,
.tool-button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
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
    --toolbar-control-size: 30px;
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
    --toolbar-control-size: 28px;
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
</style>
