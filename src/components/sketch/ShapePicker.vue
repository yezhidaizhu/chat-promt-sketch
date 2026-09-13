<script setup>
import { Shapes } from "@lucide/vue";
import Tooltip from "../Tooltip.vue";

defineProps({
  active: Boolean,
  activeShape: {
    type: String,
    default: "rectangle",
  },
  open: Boolean,
});

const emit = defineEmits(["toggle"]);
</script>

<template>
  <div class="shape-picker">
    <Tooltip label="形状">
      <button
        class="tool-button"
        :class="{ 'is-active': active }"
        type="button"
        aria-label="选择形状"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click="emit('toggle', $event.currentTarget)"
      >
        <Shapes :size="20" aria-hidden="true" />
      </button>
    </Tooltip>
  </div>
</template>

<style scoped>
.shape-picker {
  position: relative;
  pointer-events: auto;
}

.tool-button {
  display: grid;
  width: var(--toolbar-control-size, var(--sketch-control-size));
  height: var(--toolbar-control-size, var(--sketch-control-size));
  flex: 0 0 var(--toolbar-control-size, var(--sketch-control-size));
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sketch-color-text-muted);
  cursor: pointer;
  transition: color var(--sketch-transition-fast), background-color var(--sketch-transition-fast);
}

.tool-button:hover {
  background: var(--sketch-color-control-hover);
  color: var(--sketch-color-text);
}

.tool-button.is-active {
  background: var(--sketch-color-control-active);
  color: var(--sketch-color-text);
}

.tool-button.is-active:hover {
  background: var(--sketch-color-control-hover);
}

.tool-button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

</style>
