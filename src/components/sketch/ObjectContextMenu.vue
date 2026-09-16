<script setup>
import { BringToFront, LayersArrowDown, LayersArrowUp, SendToBack } from "@lucide/vue";
import { onMounted, ref } from "vue";
import { locale } from "../../locales/index.js";

defineProps({
  canMoveBackward: Boolean,
  canMoveForward: Boolean,
});

const emit = defineEmits(["send-to-back", "move-backward", "move-forward", "bring-to-front"]);
const copy = locale.sketch;
const menu = ref(null);

onMounted(() => menu.value?.querySelector("button:not(:disabled)")?.focus());
</script>

<template>
  <div ref="menu" class="object-context-menu" role="menu" :aria-label="copy.labels.layerOrder" @contextmenu.prevent.stop>
    <button type="button" role="menuitem" :disabled="!canMoveForward" @click="emit('bring-to-front')"><BringToFront :size="16" aria-hidden="true" /><span>{{ copy.labels.bringToFront }}</span></button>
    <button type="button" role="menuitem" :disabled="!canMoveForward" @click="emit('move-forward')"><LayersArrowUp :size="16" aria-hidden="true" /><span>{{ copy.labels.moveForward }}</span></button>
    <button type="button" role="menuitem" :disabled="!canMoveBackward" @click="emit('move-backward')"><LayersArrowDown :size="16" aria-hidden="true" /><span>{{ copy.labels.moveBackward }}</span></button>
    <button type="button" role="menuitem" :disabled="!canMoveBackward" @click="emit('send-to-back')"><SendToBack :size="16" aria-hidden="true" /><span>{{ copy.labels.sendToBack }}</span></button>
  </div>
</template>

<style scoped>
.object-context-menu {
  position: absolute;
  z-index: var(--sketch-z-popover);
  display: grid;
  width: 168px;
  padding: 4px;
  border: 1px solid var(--sketch-color-border);
  border-radius: 6px;
  background: var(--sketch-color-control);
  box-shadow: var(--sketch-shadow-popover);
}

button {
  display: grid;
  width: 100%;
  min-height: 34px;
  grid-template-columns: 22px 1fr;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--sketch-radius-sm);
  background: transparent;
  color: var(--sketch-color-text);
  cursor: pointer;
  font: 500 12px/1 var(--font-ui);
  text-align: left;
}

button:hover:not(:disabled) {
  background: var(--sketch-color-control-hover);
}

button:disabled {
  color: var(--sketch-color-text-muted);
  opacity: 0.35;
  cursor: default;
}

button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: -2px;
}
</style>
