<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  modelValue: {
    type: Number,
    required: true,
  },
  min: {
    type: Number,
    default: 2,
  },
  max: {
    type: Number,
    default: 36,
  },
});

const emit = defineEmits(["update:modelValue"]);
const dragging = ref(false);

const ratio = computed(() => (props.modelValue - props.min) / (props.max - props.min));
const thumbStyle = computed(() => ({
  top: `${(1 - ratio.value) * 192}px`,
  "--slider-percent": `${ratio.value * 100}%`,
}));

function updateValue(event, element) {
  const bounds = element.getBoundingClientRect();
  const horizontal = bounds.width > bounds.height;
  const trackStart = (horizontal ? bounds.left : bounds.top) + 16;
  const trackLength = (horizontal ? bounds.width : bounds.height) - 32;
  const pointerPosition = horizontal ? event.clientX : event.clientY;
  const position = Math.min(trackLength, Math.max(0, pointerPosition - trackStart));
  const nextRatio = horizontal ? position / trackLength : 1 - position / trackLength;
  emit("update:modelValue", Math.round(props.min + nextRatio * (props.max - props.min)));
}

function startDrag(event) {
  dragging.value = true;
  event.currentTarget.setPointerCapture(event.pointerId);
  updateValue(event, event.currentTarget);
}

function moveDrag(event) {
  if (!dragging.value) return;
  if (event.buttons === 0) {
    finishDrag(event);
    return;
  }
  updateValue(event, event.currentTarget);
}

function finishDrag(event) {
  if (!dragging.value) return;
  dragging.value = false;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function onKeydown(event) {
  const steps = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 4, PageDown: -4 };
  let value = props.modelValue;
  if (event.key === "Home") value = props.min;
  else if (event.key === "End") value = props.max;
  else if (steps[event.key]) value += steps[event.key];
  else return;
  event.preventDefault();
  emit("update:modelValue", Math.min(props.max, Math.max(props.min, value)));
}
</script>

<template>
  <aside class="brush-controls" aria-label="画笔设置">
    <div
      class="size-control"
      :class="{ 'is-dragging': dragging }"
      role="slider"
      tabindex="0"
      title="画笔粗细"
      aria-label="画笔粗细"
      aria-orientation="vertical"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-valuetext="`${modelValue} 像素`"
      @pointerdown.prevent="startDrag"
      @pointermove.prevent="moveDrag"
      @pointerup.prevent="finishDrag"
      @pointercancel.prevent="finishDrag"
      @lostpointercapture="finishDrag"
      @keydown="onKeydown"
    >
      <span class="size-control__track" aria-hidden="true"></span>
      <span class="size-control__scale" aria-hidden="true"></span>
      <span class="size-control__thumb" :style="thumbStyle" aria-hidden="true"></span>
    </div>
  </aside>
</template>

<style scoped>
.brush-controls {
  position: absolute;
  z-index: var(--sketch-z-brush-controls);
  top: 50%;
  left: 6px;
  display: flex;
  width: 48px;
  align-items: center;
  flex-direction: column;
  transform: translateY(-50%);
}

.size-control {
  position: relative;
  width: 48px;
  height: var(--sketch-slider-height);
  cursor: ns-resize;
  touch-action: none;
}

.size-control__track {
  position: absolute;
  top: var(--sketch-slider-inset);
  bottom: var(--sketch-slider-inset);
  left: 50%;
  width: 2px;
  border-radius: var(--sketch-radius-pill);
  background: var(--sketch-slider-track);
  transform: translateX(-50%);
  transition: opacity var(--sketch-transition-fast);
}

.size-control__scale {
  position: absolute;
  top: var(--sketch-slider-inset);
  left: 8px;
  width: 32px;
  height: 192px;
  background: var(--sketch-slider-scale);
  clip-path: polygon(0 0, 100% 0, 53% 100%, 47% 100%);
  opacity: 0;
  pointer-events: none;
  transform: scaleX(0.06);
  transform-origin: 50% 100%;
  transition: opacity var(--sketch-transition-fast), transform var(--sketch-transition-expand);
}

.size-control__thumb {
  position: absolute;
  left: 8px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  transition: background-color var(--sketch-transition-fast);
}

.size-control__thumb::after {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sketch-slider-thumb);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
  content: "";
  transition: transform var(--sketch-transition-fast), box-shadow var(--sketch-transition-fast);
}

.size-control:hover .size-control__track,
.size-control:focus-visible .size-control__track,
.size-control.is-dragging .size-control__track {
  opacity: 0;
}

.size-control:hover .size-control__scale,
.size-control:focus-visible .size-control__scale,
.size-control.is-dragging .size-control__scale {
  opacity: 1;
  transform: scaleX(1);
}

.size-control:hover .size-control__thumb,
.size-control.is-dragging .size-control__thumb {
  background: var(--sketch-slider-thumb-hover);
}

.size-control:hover .size-control__thumb::after,
.size-control.is-dragging .size-control__thumb::after {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.18), 0 2px 4px rgba(0, 0, 0, 0.28);
  transform: scale(1.08);
}

.size-control:focus-visible {
  border-radius: var(--sketch-radius-sm);
  outline: 2px solid var(--sketch-color-focus);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .brush-controls {
    top: auto;
    bottom: 56px;
    left: var(--sketch-space-3);
    width: auto;
    flex-direction: row;
    transform: none;
  }

  .size-control {
    width: min(42vw, 180px);
    height: 48px;
    cursor: ew-resize;
  }

  .size-control__track {
    top: 50%;
    right: var(--sketch-slider-inset);
    bottom: auto;
    left: var(--sketch-slider-inset);
    width: auto;
    height: 2px;
    transform: translateY(-50%);
  }

  .size-control:hover .size-control__track,
  .size-control:focus-visible .size-control__track,
  .size-control.is-dragging .size-control__track {
    opacity: 1;
  }

  .size-control__scale {
    display: none;
  }

  .size-control__thumb {
    top: 8px !important;
    left: clamp(0px, calc(var(--slider-percent) - 16px), calc(100% - 32px));
  }
}
</style>
