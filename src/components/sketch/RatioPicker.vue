<script setup>
import { Ratio } from "@lucide/vue";

defineProps({
  active: Boolean,
  current: {
    type: String,
    required: true,
  },
  open: Boolean,
});

const emit = defineEmits(["toggle"]);
</script>

<template>
  <div class="ratio-picker">
    <button
      class="tool-button"
      :class="{ 'is-active': active }"
      type="button"
      title="画布比例"
      aria-label="画布比例"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="emit('toggle', $event.currentTarget)"
    >
      <Ratio :size="20" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.ratio-picker {
  position: relative;
  pointer-events: auto;
}

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
  transition: color var(--sketch-transition-fast), background-color var(--sketch-transition-fast);
}

.tool-button:hover,
.tool-button.is-active {
  background: var(--sketch-color-control-hover);
  color: var(--sketch-color-text);
}

.tool-button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

</style>
