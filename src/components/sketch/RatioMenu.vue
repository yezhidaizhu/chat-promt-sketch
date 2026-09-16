<script setup>
import { Maximize2 } from "@lucide/vue";
import { sketchConfig } from "../../config/sketch.js";
import { locale } from "../../locales/index.js";

const copy = locale.sketch;

defineProps({ current: { type: String, required: true } });
const emit = defineEmits(["select"]);
const ratios = sketchConfig.ratios.map((ratio) => ({ ...ratio, label: copy.ratios[ratio.id] }));

function previewStyle(item) {
  const ratio = item.width / item.height;
  const width = Math.min(28, 25 * ratio);
  const height = Math.min(25, 28 / ratio);
  return { width: `${width}px`, height: `${height}px` };
}
</script>

<template>
  <div class="ratio-menu" :aria-label="copy.labels.ratioMenu">
    <button v-for="item in ratios" :key="item.id" class="ratio-option" :class="{ 'is-active': current === item.id }" type="button" role="menuitemradio" :aria-label="`${item.label} ${item.id}`" :aria-checked="current === item.id" @click="emit('select', item.id)">
      <span class="ratio-preview" :style="previewStyle(item)" aria-hidden="true"></span>
      <span class="ratio-label">{{ item.id }}</span>
    </button>
    <button class="ratio-option ratio-option-fill" :class="{ 'is-active': current === 'fill' }" type="button" role="menuitemradio" :aria-label="copy.labels.fillWindow" :aria-checked="current === 'fill'" @click="emit('select', 'fill')">
      <span class="ratio-preview ratio-preview-fill" aria-hidden="true"><Maximize2 :size="15" /></span>
      <span class="ratio-label">Fill</span>
    </button>
  </div>
</template>

<style scoped>
.ratio-menu { display: grid; width: 176px; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.ratio-option { display: flex; min-width: 0; min-height: 54px; align-items: center; justify-content: center; gap: 5px; padding: 6px 3px; border: 0; border-radius: var(--sketch-radius-sm); background: transparent; color: var(--sketch-color-text-muted); cursor: pointer; flex-direction: column; }
.ratio-option:hover, .ratio-option.is-active { background: var(--sketch-color-control-hover); color: var(--sketch-color-text); }
.ratio-option:focus-visible { outline: 2px solid var(--sketch-color-focus); outline-offset: 2px; }
.ratio-preview { display: block; flex: 0 0 auto; border: 1.5px solid currentColor; border-radius: 2px; }
.ratio-preview-fill { display: grid; width: 28px; height: 25px; place-items: center; border-style: dashed; }
.ratio-label { font-size: 11px; font-weight: 650; line-height: 1; }
</style>
