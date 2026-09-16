<script setup>
import { Hand, Minus, Plus } from "@lucide/vue";
import { locale } from "../../locales/index.js";

const copy = locale.sketch;

defineProps({
  zoomPercent: { type: Number, required: true },
  panActive: Boolean,
  canZoomIn: Boolean,
  canZoomOut: Boolean,
});

const emit = defineEmits(["toggle-pan", "zoom-in", "zoom-out", "reset"]);
</script>

<template>
  <div class="view-controls-menu" :aria-label="copy.labels.viewControls">
    <button type="button" role="menuitemcheckbox" :class="{ 'is-active': panActive }" :title="copy.labels.panCanvas" :aria-label="copy.labels.panCanvas" :aria-checked="panActive" @click="emit('toggle-pan')"><Hand :size="18" aria-hidden="true" /></button>
    <button type="button" role="menuitem" :title="copy.labels.zoomOut" :aria-label="copy.labels.zoomOut" :disabled="!canZoomOut" @click="emit('zoom-out')"><Minus :size="18" aria-hidden="true" /></button>
    <button class="zoom-value" type="button" role="menuitem" :title="copy.labels.resetView" :aria-label="`${copy.labels.resetView}: ${zoomPercent}%`" @click="emit('reset')">{{ zoomPercent }}%</button>
    <button type="button" role="menuitem" :title="copy.labels.zoomIn" :aria-label="copy.labels.zoomIn" :disabled="!canZoomIn" @click="emit('zoom-in')"><Plus :size="18" aria-hidden="true" /></button>
  </div>
</template>

<style scoped>
.view-controls-menu {
  display: flex;
  align-items: center;
  gap: 2px;
}

.view-controls-menu button {
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

.view-controls-menu button:hover:not(:disabled),
.view-controls-menu button.is-active {
  background: var(--sketch-color-control-hover);
  color: var(--sketch-color-text);
}

.view-controls-menu button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

.view-controls-menu button:disabled {
  opacity: 0.3;
  cursor: default;
}

.view-controls-menu .zoom-value {
  width: 48px;
  border-radius: var(--sketch-radius-sm);
  font: 600 12px/1 var(--font-ui);
  font-variant-numeric: tabular-nums;
}

@media (pointer: coarse) {
  .view-controls-menu button {
    width: 44px;
    height: 44px;
  }

  .view-controls-menu .zoom-value {
    width: 52px;
  }
}
</style>
