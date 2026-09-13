<script setup>
import { onBeforeUnmount } from "vue";
import { sketchConfig } from "../../config/sketch.js";

defineProps({ current: { type: String, required: true } });
const emit = defineEmits(["preview", "select"]);
let frame = 0;
let previewColor = "";

const colors = sketchConfig.backgroundColors;

function queuePreview(event) {
  previewColor = event.target.value;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    emit("preview", previewColor);
    frame = 0;
  });
}

function selectCustomColor(event) {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  emit("select", event.target.value);
}

onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <div class="background-color-menu" :aria-label="sketchConfig.labels.backgroundMenu">
    <button v-for="color in colors" :key="color.value" class="background-color-option" :class="{ 'is-active': current === color.value }" type="button" role="menuitemradio" :aria-label="`${color.name}背景`" :aria-checked="current === color.value" :style="{ backgroundColor: color.value }" @click="emit('select', color.value)"></button>
    <label class="background-color-option is-custom" :title="sketchConfig.labels.customBackground" :aria-label="sketchConfig.labels.customBackground">
      <input type="color" :value="current" @input="queuePreview" @change="selectCustomColor" />
    </label>
  </div>
</template>

<style scoped>
.background-color-menu { display: flex; align-items: center; gap: 6px; }
.background-color-option { position: relative; width: 24px; height: 24px; padding: 0; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 50%; cursor: pointer; }
.background-color-option:hover { scale: 1.05; }
.background-color-option.is-active { box-shadow: 0 0 0 2px var(--sketch-color-surface-raised), 0 0 0 4px var(--sketch-color-focus); }
.background-color-option:focus-visible { outline: 2px solid var(--sketch-color-focus); outline-offset: 3px; }
.background-color-option.is-custom { overflow: hidden; border: 0; background: conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444); }
.background-color-option input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
</style>
