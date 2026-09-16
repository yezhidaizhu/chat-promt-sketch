<script setup>
import { ref } from "vue";
import { locale } from "../../locales/index.js";

defineProps({
  modelValue: { type: String, required: true },
  style: { type: Object, required: true },
});

const emit = defineEmits(["update:modelValue", "transform-start", "transform-move", "transform-end", "cancel", "commit"]);
const input = ref(null);
const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const copy = locale.sketch;

function handleLabel(handle) {
  return ["e", "w"].includes(handle) ? copy.labels.textResizeWidth : copy.labels.textScale;
}

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
  <div
    class="canvas-text-editor"
    :style="style"
    :title="copy.labels.textMove"
    @pointerdown.self.prevent.stop="emit('transform-start', $event, 'move')"
    @pointermove.prevent="emit('transform-move', $event)"
    @pointerup.prevent="emit('transform-end', $event)"
    @pointercancel.prevent="emit('transform-end', $event)"
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
    <button
      v-for="handle in handles"
      :key="handle"
      class="text-resize-handle"
      :class="`is-${handle}`"
      type="button"
      tabindex="-1"
      :aria-label="`${handleLabel(handle)} ${handle}`"
      @pointerdown.prevent.stop="emit('transform-start', $event, 'resize', handle)"
      @pointermove.prevent="emit('transform-move', $event)"
      @pointerup.prevent="emit('transform-end', $event)"
      @pointercancel.prevent="emit('transform-end', $event)"
    ></button>
  </div>
</template>

<style scoped>
.canvas-text-editor { position: absolute; z-index: var(--sketch-z-popover); padding: 6px; border: 1.5px dashed #2c67c5; background: transparent; cursor: move; user-select: none; }
.canvas-text-input { display: block; width: 100%; height: 100%; min-width: 0; padding: 0; overflow: hidden; border: 0; outline: 0; background: transparent; color: inherit; font-family: Inter, sans-serif; font-size: inherit; font-weight: 600; line-height: 1.25; cursor: text; resize: none; user-select: text; white-space: pre-wrap; overflow-wrap: anywhere; }
.canvas-text-input:focus-visible { outline: 0; }
.text-resize-handle { position: absolute; width: 12px; height: 12px; padding: 0; border: 2px solid #2c67c5; background: #ffffff; }
.text-resize-handle.is-nw { top: -6px; left: -6px; cursor: nwse-resize; }.text-resize-handle.is-ne { top: -6px; right: -6px; cursor: nesw-resize; }.text-resize-handle.is-n { top: -6px; left: 50%; cursor: ns-resize; transform: translateX(-50%); }.text-resize-handle.is-e { top: 50%; right: -6px; cursor: ew-resize; transform: translateY(-50%); }.text-resize-handle.is-se { right: -6px; bottom: -6px; cursor: nwse-resize; }.text-resize-handle.is-sw { bottom: -6px; left: -6px; cursor: nesw-resize; }.text-resize-handle.is-s { bottom: -6px; left: 50%; cursor: ns-resize; transform: translateX(-50%); }.text-resize-handle.is-w { top: 50%; left: -6px; cursor: ew-resize; transform: translateY(-50%); }
</style>
