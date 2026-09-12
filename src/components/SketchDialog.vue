<script setup>
import SketchWorkspace from "./sketch/SketchWorkspace.vue";

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue", "download"]);
</script>

<template>
  <SketchWorkspace
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    @download="emit('download', $event)"
  />
</template>
