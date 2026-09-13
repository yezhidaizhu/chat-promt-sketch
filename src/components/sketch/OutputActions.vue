<script setup>
import { ref } from "vue";
import { Check, ChevronsDown, ChevronsUp, Copy, Download } from "@lucide/vue";
import SketchControlPill from "./SketchControlPill.vue";
import { locale } from "../../locales/index.js";

const copy = locale.sketch;

defineProps({
  disabled: Boolean,
  canCopy: Boolean,
  copySucceeded: Boolean,
  outside: Boolean,
});

const emit = defineEmits(["download", "copy"]);
const expanded = ref(false);
</script>

<template>
  <div class="output-actions" :class="{ 'is-outside': outside }">
    <SketchControlPill class="output-main" :class="{ 'is-expanded': expanded }">
      <button v-if="expanded" class="output-button copy-button" :class="{ 'is-success': copySucceeded }" type="button" :title="copy.labels.copyPng" :aria-label="copy.labels.copyPng" :disabled="!canCopy || copySucceeded" @click="emit('copy')"><Check v-if="copySucceeded" :size="19" aria-hidden="true" /><Copy v-else :size="18" aria-hidden="true" /></button>
      <div v-if="expanded" class="download-section">
        <button class="output-button" type="button" :title="copy.labels.downloadPng" :aria-label="copy.labels.downloadPng" :disabled="disabled" @click="emit('download')"><Download :size="19" aria-hidden="true" /></button>
      </div>
      <button v-else class="output-button" type="button" :title="copy.labels.downloadPng" :aria-label="copy.labels.downloadPng" :disabled="disabled" @click="emit('download')"><Download :size="19" aria-hidden="true" /></button>
    </SketchControlPill>
    <button class="output-toggle" type="button" :title="expanded ? copy.labels.collapseOutputActions : copy.labels.expandOutputActions" :aria-label="expanded ? copy.labels.collapseOutputActions : copy.labels.expandOutputActions" :aria-expanded="expanded" @click="expanded = !expanded"><ChevronsDown v-if="expanded" :size="18" aria-hidden="true" /><ChevronsUp v-else :size="18" aria-hidden="true" /></button>
  </div>
</template>

<style scoped>
.output-actions {
  position: absolute;
  z-index: var(--sketch-z-controls);
  right: var(--sketch-space-3);
  bottom: calc(var(--sketch-space-3) - 3px);
  display: flex;
  align-items: flex-end;
  pointer-events: auto;
  transition: bottom var(--sketch-transition-expand);
}

.output-actions.is-outside { bottom: calc(-1 * (40px + var(--sketch-space-3)) - 3px); }

.output-main {
  flex-direction: column;
  width: calc(var(--sketch-control-size) + var(--sketch-space-1) * 2 + 2px);
  gap: 2px;
  border-radius: var(--sketch-radius-pill) 0 0 var(--sketch-radius-pill);
}

.output-main.is-expanded {
  display: grid;
  height: calc(var(--sketch-control-size) * 2 + var(--sketch-space-1) * 4 + 4px);
  grid-template-rows: calc(var(--sketch-control-size) + var(--sketch-space-1) * 2 + 1px) calc(var(--sketch-control-size) + var(--sketch-space-1) * 2 + 1px);
  justify-items: center;
  gap: 0;
  padding: 0;
  border-radius: var(--sketch-radius-pill) var(--sketch-radius-pill) 0 var(--sketch-radius-pill);
}

.download-section {
  display: grid;
  align-self: stretch;
  margin: 0 -1px;
  place-items: center;
  border-top: 1px solid var(--sketch-color-border);
}

.output-button {
  display: grid;
  width: var(--sketch-control-size);
  height: var(--sketch-control-size);
  flex: 0 0 var(--sketch-control-size);
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sketch-color-text-muted);
  cursor: pointer;
  transition: background-color var(--sketch-transition-fast), color var(--sketch-transition-fast), opacity var(--sketch-transition-fast);
}

.output-button:hover:not(:disabled) { background: var(--sketch-color-control-hover); color: var(--sketch-color-text); }
.output-button:focus-visible,
.output-toggle:focus-visible { outline: 2px solid #2c67c5; outline-offset: 3px; }
.output-button:disabled { opacity: 0.35; cursor: not-allowed; }
.output-button.is-success { color: var(--sketch-color-selection); }

.output-toggle {
  display: grid;
  width: 32px;
  height: calc(var(--sketch-control-size) + var(--sketch-space-1) * 2 + 2px);
  margin-left: 0;
  padding: 0;
  place-items: center;
  border: 1px solid var(--sketch-color-border);
  border-left: 0;
  border-radius: 0 var(--sketch-radius-pill) var(--sketch-radius-pill) 0;
  background: rgba(27, 27, 27, 0.62);
  color: var(--sketch-color-text-muted);
  cursor: pointer;
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  backdrop-filter: blur(12px) saturate(120%);
  transition: background-color var(--sketch-transition-fast), color var(--sketch-transition-fast);
}

.output-toggle:hover { background: var(--sketch-color-control-hover); color: var(--sketch-color-text); }

.output-actions.is-outside .output-main,
.output-actions.is-outside .output-toggle {
  background: var(--sketch-color-control);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

@media (max-width: 720px) {
  .output-actions.is-outside { right: 0; bottom: calc(-1 * (40px + var(--sketch-space-3)) - 3px); }
}
</style>
