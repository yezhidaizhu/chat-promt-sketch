<script setup>
import { ref } from "vue";
import { locale } from "../../locales/index.js";

defineProps({
  modelValue: { type: String, required: true },
  style: { type: Object, required: true },
});

const emit = defineEmits(["update:modelValue", "cancel", "commit"]);
const input = ref(null);
const copy = locale.sketch;

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
  <div class="canvas-text-editor" :style="style">
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
  </div>
</template>

<style scoped>
.canvas-text-editor { position: absolute; z-index: var(--sketch-z-popover); box-sizing: content-box; padding: 6px; background: transparent; user-select: none; }
.canvas-text-input { display: block; width: 100%; height: 100%; min-width: 0; padding: 0; overflow: hidden; border: 0; outline: 0; background: transparent; color: inherit; font-family: Inter, sans-serif; font-size: inherit; font-weight: 600; line-height: 1.25; cursor: text; resize: none; user-select: text; white-space: pre-wrap; overflow-wrap: anywhere; }
.canvas-text-input:focus-visible { outline: 0; }
</style>
