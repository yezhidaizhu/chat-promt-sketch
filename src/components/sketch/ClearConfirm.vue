<script setup>
const emit = defineEmits(["confirm", "cancel"]);
</script>

<template>
  <div class="clear-confirm" aria-label="确认清空画布">
    <p>清空画布？</p>
    <div class="clear-confirm__actions">
      <button type="button" @click="emit('cancel')">取消</button>
      <button class="is-danger" type="button" @click="emit('confirm')">清空</button>
    </div>
  </div>
</template>

<style scoped>
.clear-confirm { width: 168px; color: var(--sketch-color-text); }
.clear-confirm p { margin: 2px 0 10px; font-size: 13px; font-weight: 650; }
.clear-confirm__actions { display: flex; justify-content: flex-end; gap: 6px; }
.clear-confirm button { padding: 5px 9px; border: 1px solid var(--sketch-color-border); border-radius: var(--sketch-radius-sm); background: transparent; color: var(--sketch-color-text-muted); cursor: pointer; }
.clear-confirm button:hover { background: var(--sketch-color-control-hover); color: var(--sketch-color-text); }
.clear-confirm button.is-danger { border-color: transparent; background: #dc2626; color: #fff; }
.clear-confirm button.is-danger:hover { background: #ef4444; }
</style>
