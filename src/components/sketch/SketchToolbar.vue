<script setup>
import { Eraser, MousePointer2, Pencil, Redo2, Trash2, Type, Undo2, X } from "@lucide/vue";
import ShapePicker from "./ShapePicker.vue";

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
  hasContent: Boolean,
});

const emit = defineEmits(["close", "select-tool", "toggle-shapes", "select-shape", "undo", "redo", "clear"]);

const tools = [
  { id: "select", label: "选择并移动", icon: MousePointer2 },
  { id: "pen", label: "画笔", icon: Pencil },
  { id: "text", label: "文字", icon: Type },
];
</script>

<template>
  <header class="editor-header">
    <button class="icon-button close-button" type="button" title="关闭" aria-label="关闭画板" @click="emit('close')">
      <X :size="21" aria-hidden="true" />
    </button>

    <div class="tool-group" role="toolbar" aria-label="绘图工具">
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
        @toggle="emit('toggle-shapes')"
        @select="emit('select-shape', $event)"
      />

      <button
        class="tool-button"
        :class="{ 'is-active': activeTool === 'eraser' }"
        type="button"
        title="橡皮擦"
        aria-label="橡皮擦"
        :aria-pressed="activeTool === 'eraser'"
        @click="emit('select-tool', 'eraser')"
      >
        <Eraser :size="20" aria-hidden="true" />
      </button>
    </div>

    <div class="action-group" role="group" aria-label="历史">
      <button class="icon-button" type="button" title="撤销 (Command/Ctrl+Z)" aria-label="撤销" :disabled="!canUndo" @click="emit('undo')">
        <Undo2 :size="20" aria-hidden="true" />
      </button>
      <button class="icon-button" type="button" title="重做 (Command/Ctrl+Shift+Z)" aria-label="重做" :disabled="!canRedo" @click="emit('redo')">
        <Redo2 :size="20" aria-hidden="true" />
      </button>
      <button class="icon-button" type="button" title="清空画布" aria-label="清空画布" :disabled="!hasContent" @click="emit('clear')">
        <Trash2 :size="19" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<style scoped>
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
.tool-button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

@media (max-width: 640px) {
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
}

@media (max-width: 420px) {
  .tool-group {
    gap: 0;
    padding: 2px;
  }
}
</style>
