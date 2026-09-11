<script setup>
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Heart,
  Minus,
  Shapes,
  Square,
  Star,
  Triangle,
} from "@lucide/vue";

defineProps({
  active: Boolean,
  activeShape: {
    type: String,
    default: "rectangle",
  },
  open: Boolean,
});

const emit = defineEmits(["toggle", "select"]);

const shapes = [
  { id: "line", label: "直线", icon: Minus },
  { id: "arrow", label: "箭头", icon: ArrowUpRight },
  { id: "rectangle", label: "矩形", icon: Square },
  { id: "ellipse", label: "椭圆", icon: Circle },
  { id: "triangle", label: "三角形", icon: Triangle },
  { id: "diamond", label: "菱形", icon: Diamond },
  { id: "star", label: "星形", icon: Star },
  { id: "heart", label: "心形", icon: Heart },
];
</script>

<template>
  <div class="shape-picker">
    <button
      class="tool-button"
      :class="{ 'is-active': active }"
      type="button"
      title="形状"
      aria-label="选择形状"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="emit('toggle')"
    >
      <Shapes :size="20" aria-hidden="true" />
    </button>

    <div v-if="open" class="shape-menu" role="menu">
      <button
        v-for="shape in shapes"
        :key="shape.id"
        class="shape-option"
        :class="{ 'is-active': activeShape === shape.id }"
        type="button"
        role="menuitemradio"
        :title="shape.label"
        :aria-label="shape.label"
        :aria-checked="activeShape === shape.id"
        @click="emit('select', shape)"
      >
        <component :is="shape.icon" :size="18" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.shape-picker {
  position: relative;
  pointer-events: auto;
}

.tool-button {
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
  transition: color var(--sketch-transition-fast), background-color var(--sketch-transition-fast);
}

.tool-button:hover {
  background: var(--sketch-color-control-hover);
  color: var(--sketch-color-text);
}

.tool-button.is-active {
  background: var(--sketch-color-control-active);
  color: var(--sketch-color-text);
}

.tool-button.is-active:hover {
  background: var(--sketch-color-control-hover);
}

.tool-button:focus-visible,
.shape-menu button:focus-visible {
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

.shape-menu {
  position: absolute;
  z-index: var(--sketch-z-popover);
  top: calc(100% + 8px);
  left: 50%;
  display: grid;
  width: 160px;
  grid-template-columns: repeat(4, 32px);
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--sketch-color-border);
  border-radius: 20px;
  background: var(--sketch-color-surface-raised);
  box-shadow: var(--sketch-shadow-popover);
  transform: translateX(-50%);
}

.shape-menu button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sketch-color-text);
  cursor: pointer;
  transition: color var(--sketch-transition-fast), background-color var(--sketch-transition-fast);
}

.shape-menu button:hover,
.shape-menu button.is-active {
  background: var(--sketch-color-control-hover);
}
</style>
