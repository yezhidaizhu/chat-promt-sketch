<script setup>
import { computed } from "vue";
import { CircleAlert, CircleCheck, Info, X } from "@lucide/vue";
import { dismissToast, toastState } from "../composables/useToast.js";
import { locale } from "../locales/index.js";

const copy = locale.sketch;
const icons = { error: CircleAlert, success: CircleCheck, info: Info };
const icon = computed(() => icons[toastState.value?.type] || Info);
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toastState" :key="toastState.id" class="toast" :class="`is-${toastState.type}`" :role="toastState.type === 'error' ? 'alert' : 'status'">
        <component :is="icon" class="toast__icon" :size="17" aria-hidden="true" />
        <span>{{ toastState.message }}</span>
        <button type="button" :title="copy.labels.dismiss" :aria-label="copy.labels.dismiss" @click="dismissToast"><X :size="15" aria-hidden="true" /></button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  z-index: 2147483647;
  top: 24px;
  left: 50%;
  display: grid;
  width: max-content;
  max-width: min(360px, calc(100vw - 32px));
  min-height: 40px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 8px 7px 12px;
  border: 1px solid var(--sketch-color-border);
  border-radius: 20px;
  background: var(--sketch-color-surface-raised);
  box-shadow: var(--sketch-shadow-popover);
  color: var(--sketch-color-text);
  font: 500 12px/1.4 var(--font-ui);
  transform: translateX(-50%);
}

.toast__icon { color: var(--sketch-color-text-muted); }
.toast.is-error .toast__icon { color: #f87171; }
.toast.is-success .toast__icon { color: var(--sketch-color-selection); }
.toast span { overflow-wrap: anywhere; }

.toast button {
  display: grid;
  width: 26px;
  height: 26px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sketch-color-text-muted);
  cursor: pointer;
}

.toast button:hover { background: var(--sketch-color-control-hover); color: var(--sketch-color-text); }
.toast button:focus-visible { outline: 2px solid var(--sketch-color-focus); outline-offset: 1px; }
.toast-enter-active, .toast-leave-active { transition: opacity var(--sketch-transition-fast), transform var(--sketch-transition-fast); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -6px); }
.toast-enter-to, .toast-leave-from { transform: translateX(-50%); }
</style>
