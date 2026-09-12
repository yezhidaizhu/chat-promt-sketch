<script setup>
defineProps({ outside: Boolean });
</script>

<template>
  <svg class="move-controls-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="4" y="7" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5" />
    <path d="M4 2.5h12M4 18.5h12M1.5 8.5v5M18.5 8.5v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <path v-if="!outside" d="M10 10.5V2.5m0 0L7.6 5M10 2.5 12.4 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <path v-else d="M10 2.5V13m0 0-2.4-2.4M10 13l2.4-2.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>

<style scoped>
.move-controls-icon { display: block; width: 19px; height: 22px; }
</style>
