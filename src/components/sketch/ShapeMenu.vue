<script setup>
import { ArrowUpRight, Circle, Diamond, Heart, Minus, Square, Star, Triangle } from "@lucide/vue";
import { locale } from "../../locales/index.js";

defineProps({ activeShape: { type: String, default: "rectangle" } });
const emit = defineEmits(["select"]);
const copy = locale.sketch;
const shapes = [
  { id: "line", icon: Minus }, { id: "arrow", icon: ArrowUpRight },
  { id: "rectangle", icon: Square }, { id: "ellipse", icon: Circle },
  { id: "triangle", icon: Triangle }, { id: "diamond", icon: Diamond },
  { id: "star", icon: Star }, { id: "heart", icon: Heart },
].map((shape) => ({ ...shape, label: copy.shapes[shape.id] }));
</script>

<template>
  <div class="shape-menu">
    <button v-for="shape in shapes" :key="shape.id" class="shape-option" :class="{ 'is-active': activeShape === shape.id }" type="button" role="menuitemradio" :title="shape.label" :aria-label="shape.label" :aria-checked="activeShape === shape.id" @click="emit('select', shape)">
      <component :is="shape.icon" :size="18" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.shape-menu { display: grid; width: max-content; grid-template-columns: repeat(4, 32px); gap: 4px; }
.shape-option { display: grid; width: 32px; height: 32px; padding: 0; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--sketch-color-text); cursor: pointer; }
.shape-option:hover, .shape-option.is-active { background: var(--sketch-color-control-hover); }
.shape-option:focus-visible { outline: 2px solid var(--sketch-color-focus); outline-offset: 2px; }
</style>
