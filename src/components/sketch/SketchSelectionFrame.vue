<script setup>
import { RotateCw } from "@lucide/vue";

const props = defineProps({
  frameStyle: {
    type: Object,
    required: true,
  },
  interactive: Boolean,
  rotateAbove: Boolean,
});

const emit = defineEmits(["transform-start", "transform-move", "transform-end"]);
const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function start(event, type, handle = null) {
  if (props.interactive) emit("transform-start", event, type, handle);
}

function move(event) {
  if (props.interactive) emit("transform-move", event);
}

function finish(event) {
  if (props.interactive) emit("transform-end", event);
}
</script>

<template>
  <div
    class="selection-frame"
    :class="{ 'is-interactive': interactive }"
    :style="frameStyle"
    :aria-hidden="interactive ? undefined : true"
    @pointerdown.self.prevent.stop="start($event, 'move')"
    @pointermove.prevent="move"
    @pointerup.prevent="finish"
    @pointercancel.prevent="finish"
  >
    <slot />
    <button
      v-for="handle in handles"
      :key="handle"
      class="selection-handle"
      :class="`is-${handle}`"
      type="button"
      tabindex="-1"
      :aria-label="interactive ? `Resize ${handle}` : undefined"
      @pointerdown.prevent.stop="start($event, 'resize', handle)"
      @pointermove.prevent="move"
      @pointerup.prevent="finish"
      @pointercancel.prevent="finish"
    ></button>
    <button
      class="selection-rotate-handle"
      :class="{ 'is-above': rotateAbove }"
      type="button"
      tabindex="-1"
      :aria-label="interactive ? 'Rotate' : undefined"
      @pointerdown.prevent.stop="start($event, 'rotate')"
      @pointermove.prevent="move"
      @pointerup.prevent="finish"
      @pointercancel.prevent="finish"
    ><RotateCw :size="13" aria-hidden="true" /></button>
  </div>
</template>

<style scoped>
.selection-frame {
  position: absolute;
  z-index: calc(var(--sketch-z-controls) - 1);
  box-sizing: border-box;
  border: 2px solid var(--sketch-color-selection);
  background: transparent;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.68);
  pointer-events: none;
  transform-origin: center;
  user-select: none;
}

.selection-frame.is-interactive {
  z-index: var(--sketch-z-popover);
  padding: 4px;
  pointer-events: auto;
  cursor: move;
}

.selection-handle,
.selection-rotate-handle {
  position: absolute;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.68);
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
  pointer-events: none;
}

.is-interactive .selection-handle,
.is-interactive .selection-rotate-handle {
  pointer-events: auto;
}

.selection-handle {
  z-index: 1;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.selection-handle.is-nw { top: -7px; left: -7px; cursor: nwse-resize; }
.selection-handle.is-ne { top: -7px; right: -7px; cursor: nesw-resize; }
.selection-handle.is-se { right: -7px; bottom: -7px; cursor: nwse-resize; }
.selection-handle.is-sw { bottom: -7px; left: -7px; cursor: nesw-resize; }

.selection-handle.is-n,
.selection-handle.is-s {
  width: 12px;
  height: 6px;
  border-radius: 3px;
  transform: translateX(-50%);
}

.selection-handle.is-e,
.selection-handle.is-w {
  width: 6px;
  height: 12px;
  border-radius: 3px;
  transform: translateY(-50%);
}

.selection-handle.is-n { top: -4px; left: 50%; cursor: ns-resize; }
.selection-handle.is-s { bottom: -4px; left: 50%; cursor: ns-resize; }
.selection-handle.is-e { top: 50%; right: -4px; cursor: ew-resize; }
.selection-handle.is-w { top: 50%; left: -4px; cursor: ew-resize; }

.selection-rotate-handle {
  top: calc(100% + 24px);
  left: 50%;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  color: #1b1b1b;
  cursor: grab;
  z-index: 0;
  transform: translateX(-50%);
}

.selection-rotate-handle::before {
  position: absolute;
  bottom: 100%;
  left: calc(50% - 1px);
  width: 2px;
  height: 24px;
  background: var(--sketch-color-selection);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.68);
  content: "";
  z-index: -1;
}

.selection-rotate-handle.is-above {
  top: auto;
  bottom: calc(100% + 24px);
}

.selection-rotate-handle.is-above::before {
  top: 100%;
  bottom: auto;
}

.selection-rotate-handle:active { cursor: grabbing; }
.selection-rotate-handle svg { transform: rotate(var(--selection-counter-rotation, 0rad)); }
</style>
