<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { sketchConfig } from "../../config/sketch.js";
import { locale } from "../../locales/index.js";
import { scrollWheelHorizontally } from "../../utils/scroll.js";

const copy = locale.sketch;

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  outside: Boolean,
});

const emit = defineEmits(["update:modelValue"]);
const palette = ref(null);
const hasColorsBefore = ref(false);
const hasColorsAfter = ref(false);
let colorFrame = 0;
let pendingColor = "";
let paletteObserver;

function updateOverflowHints() {
  const element = palette.value;
  if (!element) return;
  hasColorsBefore.value = element.scrollLeft > 2;
  hasColorsAfter.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
}

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

onMounted(async () => {
  await nextTick();
  updateOverflowHints();
  paletteObserver = new ResizeObserver(updateOverflowHints);
  paletteObserver.observe(palette.value);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(colorFrame);
  paletteObserver?.disconnect();
});

const colors = sketchConfig.inkColors.map((color) => ({ ...color, name: copy.colors[color.id] }));

const isCustom = computed(() => !colors.some((color) => color.value === props.modelValue.toLowerCase()));
</script>

<template>
  <div class="color-controls" :class="{ 'is-outside': outside }">
    <div class="color-palette-shell" :class="{ 'has-colors-before': hasColorsBefore, 'has-colors-after': hasColorsAfter }">
      <fieldset ref="palette" class="color-palette" :aria-label="copy.labels.palette" @scroll.passive="updateOverflowHints" @wheel="scrollWheelHorizontally">
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
    </div>
  </div>
</template>

<style scoped>
.color-controls {
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

.color-controls.is-outside {
  bottom: calc(-1 * (40px + var(--sketch-space-3)));
}

.color-palette-shell {
  position: relative;
  grid-column: 2;
  align-self: center;
  min-width: 0;
}

.color-palette {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--sketch-space-2);
  margin: 0;
  padding: 6px 4px;
  border: 0;
  pointer-events: auto;
}

.color-palette-shell.has-colors-after:not(.has-colors-before) .color-palette {
  -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 32px), transparent 100%);
  mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 32px), transparent 100%);
}

.color-palette-shell.has-colors-before:not(.has-colors-after) .color-palette {
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 100%);
}

.color-palette-shell.has-colors-before.has-colors-after .color-palette {
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
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
  box-shadow: 0 0 0 2px var(--sketch-color-surface), 0 0 0 4px var(--sketch-color-focus);
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
.color-button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 3px;
}

@media (max-width: 640px) {
  .color-controls {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .color-palette-shell {
    grid-column: 1;
    width: 100%;
  }

  .color-palette {
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
  .color-controls.is-outside {
    right: calc(var(--sketch-control-size) + var(--sketch-space-1) * 2 + 42px);
    left: 0;
  }

  .color-controls.is-outside .color-palette-shell,
  .color-controls.is-outside .color-palette {
    width: 100%;
  }

  .color-controls.is-outside .color-palette {
    max-width: none;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .color-controls.is-outside .color-palette::-webkit-scrollbar {
    display: none;
  }
}

@container (max-width: 620px) {
  .color-controls {
    right: calc(var(--sketch-space-3) + var(--sketch-control-size) * 2 + var(--sketch-space-1) * 2 + 10px);
  }

  .color-palette-shell,
  .color-palette {
    width: 100%;
  }

  .color-palette {
    max-width: none;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .color-palette::-webkit-scrollbar {
    display: none;
  }
}
</style>
