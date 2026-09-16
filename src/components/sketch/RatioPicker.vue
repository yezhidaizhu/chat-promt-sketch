<script setup>
import { Ratio } from "@lucide/vue";
import PopoverTrigger from "../PopoverTrigger.vue";
import { locale } from "../../locales/index.js";

const copy = locale.sketch;

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
    <PopoverTrigger
      class="tool-button"
      :class="{ 'is-active': active }"
      :label="copy.labels.ratio"
      :open="open"
      @toggle="emit('toggle', $event)"
    >
      <Ratio :size="20" aria-hidden="true" />
    </PopoverTrigger>
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
