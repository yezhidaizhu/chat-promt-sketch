import { shallowRef } from "vue";

export const toastState = shallowRef(null);

let timer;
let toastId = 0;

export function dismissToast() {
  clearTimeout(timer);
  toastState.value = null;
}

export function showToast(message, { type = "info", duration = 3200 } = {}) {
  const text = String(message || "").trim();
  if (!text) return;
  clearTimeout(timer);
  toastState.value = { id: toastId += 1, message: text, type };
  if (duration > 0) timer = setTimeout(dismissToast, duration);
}
