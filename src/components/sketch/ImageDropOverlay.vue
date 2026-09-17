<script setup>
import { ImagePlus } from "@lucide/vue";

defineProps({ visible: Boolean });
</script>

<template>
  <Transition name="image-drop-overlay">
    <div v-if="visible" class="image-drop-overlay" aria-hidden="true">
      <span class="image-drop-overlay__icon"><ImagePlus :size="28" /></span>
    </div>
  </Transition>
</template>

<style scoped>
.image-drop-overlay {
  position: absolute;
  z-index: var(--sketch-z-popover);
  inset: 10px;
  display: grid;
  place-items: center;
  border: 2px dashed var(--sketch-color-selection);
  border-radius: calc(var(--sketch-radius-md) - 8px);
  background: rgb(109 216 183 / 10%);
  color: var(--sketch-color-selection);
  pointer-events: none;
}

.image-drop-overlay__icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 50%;
  background: rgb(27 27 27 / 82%);
  box-shadow: var(--sketch-shadow-popover);
}

.image-drop-overlay-enter-active,
.image-drop-overlay-leave-active { transition: opacity var(--sketch-transition-fast); }
.image-drop-overlay-enter-from,
.image-drop-overlay-leave-to { opacity: 0; }
</style>
