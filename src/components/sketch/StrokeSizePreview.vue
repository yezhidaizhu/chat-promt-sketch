<script setup>
import { computed } from "vue";

const props = defineProps({
  visible: Boolean,
  size: {
    type: Number,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
});

const dotStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundColor: props.color,
}));
</script>

<template>
  <Transition name="stroke-size-preview">
    <div v-if="visible" class="stroke-size-preview" aria-hidden="true">
      <span class="stroke-size-preview__dot" :style="dotStyle"></span>
      <span class="stroke-size-preview__value">{{ size }} px</span>
    </div>
  </Transition>
</template>

<style scoped>
.stroke-size-preview {
  position: absolute;
  z-index: var(--sketch-z-brush-controls);
  top: 50%;
  left: 50%;
  display: grid;
  width: 84px;
  height: 84px;
  place-items: center;
  padding: 12px;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.stroke-size-preview__dot {
  display: block;
  max-width: 36px;
  max-height: 36px;
  align-self: end;
  border-radius: 50%;
  filter: drop-shadow(0 0 0.6px rgba(0, 0, 0, 0.95));
}

.stroke-size-preview__value {
  align-self: end;
  color: var(--sketch-color-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.stroke-size-preview-enter-active,
.stroke-size-preview-leave-active {
  transition: opacity var(--sketch-transition-fast), scale var(--sketch-transition-fast);
}

.stroke-size-preview-enter-from,
.stroke-size-preview-leave-to {
  opacity: 0;
  scale: 0.96;
}
</style>
