<script setup>
import { ref } from "vue";
import SketchSelectionFrame from "./SketchSelectionFrame.vue";
import { locale } from "../../locales/index.js";

defineProps({
  modelValue: { type: String, required: true },
  style: { type: Object, required: true },
  rotateAbove: Boolean,
});

const emit = defineEmits(["update:modelValue", "transform-start", "transform-move", "transform-end", "cancel", "commit"]);
const input = ref(null);
const copy = locale.sketch;

const forwardTransformStart = (...args) => emit("transform-start", ...args);
const forwardTransformMove = (...args) => emit("transform-move", ...args);
const forwardTransformEnd = (...args) => emit("transform-end", ...args);

function focusAtEnd() {
  input.value?.focus();
  input.value?.setSelectionRange(input.value.value.length, input.value.value.length);
}

function focus() {
  input.value?.focus();
}

defineExpose({ focus, focusAtEnd });
</script>

<template>
  <SketchSelectionFrame
    :frame-style="style"
    :interactive="true"
    :rotate-above="rotateAbove"
    @transform-start="forwardTransformStart"
    @transform-move="forwardTransformMove"
    @transform-end="forwardTransformEnd"
  >
    <textarea
      ref="input"
      :value="modelValue"
      class="canvas-text-input"
      maxlength="500"
      :aria-label="copy.labels.textInput"
      spellcheck="false"
      @input="emit('update:modelValue', $event.target.value)"
      @pointerdown.stop
      @keydown.meta.enter.prevent="$event.currentTarget.blur()"
      @keydown.ctrl.enter.prevent="$event.currentTarget.blur()"
      @keydown.esc.stop.prevent="emit('cancel')"
      @blur="emit('commit')"
    ></textarea>
  </SketchSelectionFrame>
</template>

<style scoped>
.canvas-text-input { display: block; width: 100%; height: 100%; min-width: 0; padding: 0; overflow: hidden; border: 0; outline: 0; background: transparent; color: inherit; font-family: Inter, sans-serif; font-size: inherit; font-weight: 600; line-height: 1.25; cursor: text; resize: none; user-select: text; white-space: pre-wrap; overflow-wrap: anywhere; }
.canvas-text-input:focus-visible { outline: 0; }
</style>
