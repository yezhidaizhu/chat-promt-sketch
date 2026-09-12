<script setup>
import { computed, onBeforeUnmount } from "vue";
import { Check } from "@lucide/vue";

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  disabled: Boolean,
  outside: Boolean,
});

const emit = defineEmits(["update:modelValue", "finish"]);
let colorFrame = 0;
let pendingColor = "";

function queueCustomColor(event) {
  pendingColor = event.target.value;
  if (colorFrame) return;
  colorFrame = requestAnimationFrame(() => {
    emit("update:modelValue", pendingColor);
    colorFrame = 0;
  });
}

function flushCustomColor(event) {
  if (colorFrame) cancelAnimationFrame(colorFrame);
  colorFrame = 0;
  pendingColor = event.target.value;
  emit("update:modelValue", pendingColor);
}

onBeforeUnmount(() => cancelAnimationFrame(colorFrame));

const colors = [
  { name: "白色", value: "#ffffff" },
  { name: "灰色", value: "#6b7280" },
  { name: "棕色", value: "#92400e" },
  { name: "红色", value: "#dc2626" },
  { name: "橙色", value: "#f97316" },
  { name: "黄色", value: "#f59e0b" },
  { name: "绿色", value: "#16a34a" },
  { name: "蓝绿色", value: "#0d9488" },
  { name: "青色", value: "#06b6d4" },
  { name: "蓝色", value: "#2563eb" },
  { name: "靛蓝色", value: "#4f46e5" },
  { name: "紫色", value: "#9333ea" },
  { name: "粉色", value: "#db2777" },
];

const isCustom = computed(() => !colors.some((color) => color.value === props.modelValue.toLowerCase()));
</script>

<template>
  <div class="bottom-controls" :class="{ 'is-outside': outside }">
    <fieldset class="color-palette" aria-label="墨水颜色">
      <legend class="sr-only">墨水颜色</legend>
      <label
        class="color-button custom-color"
        :class="{ 'is-selected': isCustom }"
        title="选择自定义颜色"
        aria-label="选择自定义颜色"
      >
        <input :value="modelValue" type="color" @input="queueCustomColor" @change="flushCustomColor" />
      </label>
      <button
        v-for="color in colors"
        :key="color.value"
        class="color-button"
        :class="{ 'is-selected': modelValue.toLowerCase() === color.value }"
        type="button"
        :title="color.name"
        :aria-label="`使用${color.name}`"
        :aria-pressed="modelValue.toLowerCase() === color.value"
        :style="{ backgroundColor: color.value }"
        @click="emit('update:modelValue', color.value)"
      ></button>
    </fieldset>

    <button
      class="finish-button"
      type="button"
      title="完成并下载 PNG"
      aria-label="完成并下载 PNG"
      :disabled="disabled"
      @click="emit('finish')"
    >
      <Check :size="20" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.bottom-controls {
  position: absolute;
  z-index: var(--sketch-z-controls);
  right: var(--sketch-space-3);
  bottom: var(--sketch-space-3);
  left: var(--sketch-space-3);
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: bottom var(--sketch-transition-expand);
}

.bottom-controls.is-outside {
  bottom: calc(-1 * (36px + var(--sketch-space-3)));
}

.color-palette {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--sketch-space-2);
  margin: 0;
  padding: 6px 4px;
  border: 0;
  pointer-events: auto;
}

.color-button {
  position: relative;
  display: block;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: scale var(--sketch-transition-fast), box-shadow var(--sketch-transition-fast);
}

.color-button:hover {
  scale: 1.05;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25), 0 1px 3px rgba(0, 0, 0, 0.1);
}

.color-button.is-selected {
  box-shadow: 0 0 0 2px var(--sketch-color-surface), 0 0 0 4px #2c67c5;
}

.custom-color {
  overflow: hidden;
  border: 0;
  background: var(--sketch-color-surface);
}

.custom-color::before {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444);
  content: "";
}

.custom-color:hover {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
}

.custom-color input {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.custom-color:has(input:focus-visible),
.finish-button:focus-visible,
.color-button:focus-visible {
  outline: 2px solid #2c67c5;
  outline-offset: 3px;
}

.finish-button {
  position: absolute;
  right: 0;
  display: grid;
  width: 36px;
  height: 36px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #ffffff;
  color: var(--sketch-color-surface);
  cursor: pointer;
  pointer-events: auto;
  transition: background-color var(--sketch-transition-fast), opacity var(--sketch-transition-fast);
}

.finish-button:hover:not(:disabled) {
  background: #dedede;
}

.finish-button:disabled {
  background: rgba(255, 255, 255, 0.41);
  color: #424242;
  opacity: 0.35;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .bottom-controls {
    justify-content: flex-start;
  }

  .color-palette {
    width: calc(100% - 52px);
    max-width: 448px;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .color-palette::-webkit-scrollbar {
    display: none;
  }
}

@media (max-width: 720px) {
  .bottom-controls.is-outside {
    right: 0;
    left: 136px;
    justify-content: flex-start;
  }

  .bottom-controls.is-outside .color-palette {
    width: calc(100% - 52px);
    max-width: none;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .bottom-controls.is-outside .color-palette::-webkit-scrollbar {
    display: none;
  }
}
</style>
