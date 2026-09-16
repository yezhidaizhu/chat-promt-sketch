<script setup>
import { ref } from "vue";
import { Pencil } from "@lucide/vue";
import SketchDialog from "./components/SketchDialog.vue";
import SketchPopoverRoot from "./components/SketchPopoverRoot.vue";
import ToastRoot from "./components/ToastRoot.vue";
import { locale } from "./locales/index.js";

const isSketchOpen = ref(false);
const copy = locale.sketch;
</script>

<template>
  <main class="demo-page">
    <button class="open-button" type="button" @click="isSketchOpen = true">
      <Pencil :size="19" aria-hidden="true" />
      {{ copy.labels.openSketch }}
    </button>

    <SketchDialog v-model="isSketchOpen" />
    <SketchPopoverRoot />
    <ToastRoot />
  </main>
</template>

<style scoped>
.demo-page {
  display: grid;
  min-height: 100dvh;
  padding: 24px;
  place-items: center;
}

.open-button {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 20px;
  border: 0;
  border-radius: 6px;
  background: var(--app-color-action);
  color: #ffffff;
  font-weight: 650;
  cursor: pointer;
  transition: background-color var(--sketch-transition-fast), transform var(--sketch-transition-fast);
}

.open-button:hover {
  background: var(--app-color-action-hover);
}

.open-button:active {
  transform: translateY(1px);
}

.open-button:focus-visible {
  outline: 3px solid #397b68;
  outline-offset: 3px;
}
</style>
