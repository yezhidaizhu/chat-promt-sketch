<script setup>
import SketchWorkspace from "./sketch/SketchWorkspace.vue";

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  submit: {
    type: Function,
    default: null,
  },
  embedded: Boolean,
  initialLayout: {
    type: String,
    default: "ratio",
  },
  layout: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(["update:modelValue", "update:layout", "download"]);
</script>

<template>
  <SketchWorkspace
    :model-value="modelValue"
    :submit="submit"
    :embedded="embedded"
    :initial-layout="initialLayout"
    :layout="layout"
    @update:model-value="emit('update:modelValue', $event)"
    @update:layout="emit('update:layout', $event)"
    @download="emit('download', $event)"
  />
</template>
