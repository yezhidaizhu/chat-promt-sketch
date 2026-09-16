<script setup>
defineProps({
  label: { type: String, required: true },
  title: String,
  open: Boolean,
  disabled: Boolean,
});

const emit = defineEmits(["toggle"]);

function toggle(event) {
  emit("toggle", event.currentTarget);
}
</script>

<template>
  <button
    type="button"
    :title="title || label"
    :aria-label="label"
    aria-haspopup="menu"
    :aria-expanded="open"
    :disabled="disabled"
    data-popover-trigger
    @click="toggle"
  >
    <slot />
  </button>
</template>
