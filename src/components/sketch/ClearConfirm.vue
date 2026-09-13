<script setup>
import { BrushCleaning, X } from "@lucide/vue";

const emit = defineEmits(["confirm", "cancel"]);
</script>

<template>
  <div class="clear-confirm" aria-label="确认清空画布">
    <p>清空全部内容？</p>
    <div class="clear-confirm__actions">
      <button class="cancel-button" type="button" title="取消" aria-label="取消" @click="emit('cancel')"><X :size="16" aria-hidden="true" /></button>
      <button class="confirm-button" type="button" @click="emit('confirm')"><BrushCleaning :size="16" aria-hidden="true" />清空</button>
    </div>
  </div>
</template>

<style scoped>
.clear-confirm { display: flex; align-items: center; gap: 12px; color: var(--sketch-color-text); white-space: nowrap; }
.clear-confirm p { margin: 0; font-size: 13px; font-weight: 650; }
.clear-confirm__actions { display: flex; align-items: center; gap: 4px; }
.clear-confirm button { border: 0; cursor: pointer; }
.cancel-button { display: grid; width: 28px; height: 28px; padding: 0; place-items: center; border-radius: 50%; background: transparent; color: var(--sketch-color-text-muted); }
.cancel-button:hover, .cancel-button:focus-visible { background: var(--sketch-color-control-hover); color: var(--sketch-color-text); }
.confirm-button { display: inline-flex; height: 28px; align-items: center; gap: 5px; padding: 0 10px; border-radius: var(--sketch-radius-pill); background: #dc2626; color: #fff; font-size: 12px; font-weight: 650; }
.confirm-button:hover { background: #ef4444; }
.clear-confirm button:focus-visible { outline: 2px solid var(--sketch-color-focus); outline-offset: 2px; }
</style>
