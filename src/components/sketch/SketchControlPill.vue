<script setup>
defineProps({
  solid: Boolean,
});
</script>

<template>
  <div class="sketch-control-pill" :class="{ 'is-solid': solid }">
    <slot />
  </div>
</template>

<style scoped>
.sketch-control-pill {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: var(--sketch-space-1);
  border: 1px solid var(--sketch-color-border);
  border-radius: var(--sketch-radius-pill);
  background: rgba(27, 27, 27, 0.62);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  backdrop-filter: blur(12px) saturate(120%);
}

.sketch-control-pill.is-solid {
  border-color: transparent;
  background: var(--sketch-color-control);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
</style>
