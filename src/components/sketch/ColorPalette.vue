<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { Check, ChevronsDown, ChevronsUp, Copy, Download } from "@lucide/vue";
import { sketchConfig } from "../../config/sketch.js";
import { locale } from "../../locales/index.js";

const copy = locale.sketch;

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  disabled: Boolean,
  canCopy: Boolean,
  copySucceeded: Boolean,
  outside: Boolean,
});

const emit = defineEmits(["update:modelValue", "download", "copy"]);
const outputExpanded = ref(false);
let colorFrame = 0;
let pendingColor = "";

function queueCustomColor(event) {
  pendingColor = event.target.value;
  if (colorFrame) return;
  colorFrame = requestAnimationFrame(() => {
    emit("update:modelValue", pendingColor);
    colorFrame = 0;
  });
}

function flushCustomColor(event) {
  if (colorFrame) cancelAnimationFrame(colorFrame);
  colorFrame = 0;
  pendingColor = event.target.value;
  emit("update:modelValue", pendingColor);
}

onBeforeUnmount(() => {
  cancelAnimationFrame(colorFrame);
});

const colors = sketchConfig.inkColors.map((color) => ({ ...color, name: copy.colors[color.id] }));

const isCustom = computed(() => !colors.some((color) => color.value === props.modelValue.toLowerCase()));
</script>

<template>
  <div class="bottom-controls" :class="{ 'is-outside': outside }">
    <fieldset class="color-palette" :aria-label="copy.labels.palette">
      <legend class="sr-only">{{ copy.labels.palette }}</legend>
      <label
        class="color-button custom-color"
        :class="{ 'is-selected': isCustom }"
        :title="copy.labels.customInk"
        :aria-label="copy.labels.customInk"
      >
        <input :value="modelValue" type="color" @input="queueCustomColor" @change="flushCustomColor" />
      </label>
      <button
        v-for="color in colors"
        :key="color.value"
        class="color-button"
        :class="{ 'is-selected': modelValue.toLowerCase() === color.value }"
        type="button"
        :title="color.name"
        :aria-label="`Use ${color.name}`"
        :aria-pressed="modelValue.toLowerCase() === color.value"
        :style="{ backgroundColor: color.value }"
        @click="emit('update:modelValue', color.value)"
      ></button>
    </fieldset>

    <div class="output-stack" :class="{ 'is-expanded': outputExpanded }">
      <div class="output-main">
        <div class="copy-reveal">
          <button class="output-button copy-button" :class="{ 'is-success': copySucceeded }" type="button" :title="copy.labels.copyPng" :aria-label="copy.labels.copyPng" :disabled="!canCopy || copySucceeded" @click="emit('copy')"><Check v-if="copySucceeded" :size="19" aria-hidden="true" /><Copy v-else :size="18" aria-hidden="true" /></button>
        </div>
        <button class="output-button download-button" type="button" :title="copy.labels.downloadPng" :aria-label="copy.labels.downloadPng" :disabled="disabled" @click="emit('download')"><Download :size="19" aria-hidden="true" /></button>
      </div>
      <button class="output-button output-toggle" type="button" :title="outputExpanded ? copy.labels.collapseOutputActions : copy.labels.expandOutputActions" :aria-label="outputExpanded ? copy.labels.collapseOutputActions : copy.labels.expandOutputActions" :aria-expanded="outputExpanded" @click="outputExpanded = !outputExpanded"><ChevronsUp v-if="outputExpanded" :size="18" aria-hidden="true" /><ChevronsDown v-else :size="18" aria-hidden="true" /></button>
    </div>
  </div>
</template>

<style scoped>
.bottom-controls {
  position: absolute;
  z-index: var(--sketch-z-controls);
  right: var(--sketch-space-3);
  bottom: var(--sketch-space-3);
  left: var(--sketch-space-3);
  display: grid;
  height: 40px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  pointer-events: none;
  transition: bottom var(--sketch-transition-expand);
}

.bottom-controls.is-outside {
  bottom: calc(-1 * (40px + var(--sketch-space-3)));
}

.color-palette {
  grid-column: 2;
  align-self: center;
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

.custom-color input {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.custom-color:has(input:focus-visible),
.output-button:focus-visible,
.color-button:focus-visible {
  outline: 2px solid #2c67c5;
  outline-offset: 3px;
}

.output-stack {
  --output-main-size: 44px;
  --output-toggle-size: 34px;
  --output-hover: var(--sketch-color-output-hover);
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: end;
  pointer-events: auto;
}

.output-main {
  position: relative;
  width: var(--output-main-size);
  height: var(--output-main-size);
  overflow: hidden;
  border: 1px solid var(--sketch-color-border);
  border-radius: var(--sketch-radius-pill) 0 0 var(--sketch-radius-pill);
  background: var(--sketch-color-control);
  pointer-events: auto;
}

.output-stack.is-expanded .output-main {
  height: calc(var(--output-main-size) * 2);
  border-radius: var(--sketch-radius-pill) var(--sketch-radius-pill) 0 var(--sketch-radius-pill);
  transition: height var(--sketch-transition-expand);
}

.output-button {
  display: grid;
  width: var(--output-main-size);
  height: var(--output-main-size);
  flex: 0 0 var(--output-main-size);
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--sketch-color-text-muted);
  cursor: pointer;
  transition: background-color var(--sketch-transition-fast), color var(--sketch-transition-fast), opacity var(--sketch-transition-fast);
}

.output-button:hover:not(:disabled) {
  background: var(--output-hover);
  color: var(--sketch-color-text);
}

.output-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.copy-reveal {
  position: absolute;
  bottom: var(--output-main-size);
  left: 0;
  width: 100%;
  height: var(--output-main-size);
  overflow: hidden;
}
.copy-button.is-success,
.copy-button.is-success:hover:not(:disabled) { background: rgba(109, 216, 183, 0.16); color: var(--sketch-color-selection); }

.download-button {
  position: absolute;
  right: 0;
  bottom: 0;
}
.output-stack.is-expanded .download-button { box-shadow: inset 0 1px var(--sketch-color-border); }
.download-button svg { transform: translateY(-1px); }
.output-toggle {
  width: var(--output-toggle-size);
  height: var(--output-main-size);
  flex-basis: var(--output-toggle-size);
  margin-left: -1px;
  border: 1px solid var(--sketch-color-border);
  border-radius: 0 var(--sketch-radius-pill) var(--sketch-radius-pill) 0;
  background: var(--sketch-color-control);
}

.output-toggle:hover {
  background: var(--output-hover);
  color: var(--sketch-color-text);
}

@media (max-width: 640px) {
  .bottom-controls {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .color-palette {
    grid-column: 1;
    width: 100%;
    max-width: none;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .color-palette::-webkit-scrollbar {
    display: none;
  }
}

@media (max-width: 720px) {
  .bottom-controls.is-outside {
    right: 0;
    left: 136px;
  }

  .bottom-controls.is-outside .color-palette {
    width: 100%;
    max-width: none;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .bottom-controls.is-outside .color-palette::-webkit-scrollbar {
    display: none;
  }
}
</style>
