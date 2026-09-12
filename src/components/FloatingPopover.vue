<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({ open: Boolean, anchor: Object });
const emit = defineEmits(["close"]);
const popover = ref(null);
const isPositioned = ref(false);
let frame;
let contentObserver;
let contentMutationObserver;

function position() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (!props.open || !props.anchor || !popover.value) return;
    const anchor = props.anchor.getBoundingClientRect();
    const element = popover.value;
    const parent = element.offsetParent;
    const parentRect = parent?.getBoundingClientRect();
    const scale = parent && parentRect?.width ? parentRect.width / parent.offsetWidth : 1;
    const gap = 8;
    const width = element.offsetWidth;
    const currentHeight = element.offsetHeight;
    element.style.height = "auto";
    const height = element.scrollHeight;
    if (isPositioned.value && currentHeight !== height) {
      element.style.height = `${currentHeight}px`;
      requestAnimationFrame(() => {
        if (props.open && popover.value === element) element.style.height = `${height}px`;
      });
    } else element.style.height = `${height}px`;
    const originX = parentRect ? parentRect.left : 0;
    const originY = parentRect ? parentRect.top : 0;
    const localAnchor = {
      left: (anchor.left - originX) / scale,
      top: (anchor.top - originY) / scale,
      bottom: (anchor.bottom - originY) / scale,
      width: anchor.width / scale,
    };
    const left = Math.min(Math.max((0 - originX) / scale + gap, localAnchor.left + localAnchor.width / 2 - width / 2), (window.innerWidth - originX) / scale - width - gap);
    const top = localAnchor.bottom + gap + height <= (window.innerHeight - originY) / scale ? localAnchor.bottom + gap : localAnchor.top - gap - height;
    element.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(gap, top))}px)`;
    requestAnimationFrame(() => { if (props.open) isPositioned.value = true; });
  });
}

function onPointerDown(event) {
  if (popover.value?.contains(event.target) || props.anchor?.contains(event.target) || event.target.closest?.('[aria-haspopup="menu"]')) return;
  emit("close");
}

function onKeydown(event) {
  if (event.key === "Escape") { event.preventDefault(); emit("close"); }
}

watch(() => props.open, async (open) => {
  if (open) {
    await nextTick();
    position();
    contentObserver = new ResizeObserver(position);
    if (popover.value.firstElementChild) contentObserver.observe(popover.value.firstElementChild);
    contentMutationObserver = new MutationObserver(() => {
      contentObserver?.disconnect();
      if (popover.value?.firstElementChild) contentObserver?.observe(popover.value.firstElementChild);
      position();
    });
    contentMutationObserver.observe(popover.value, { childList: true, subtree: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
  } else {
    isPositioned.value = false;
    contentObserver?.disconnect(); contentMutationObserver?.disconnect();
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true);
  }
});

watch(() => props.anchor, async () => { if (props.open) { await nextTick(); position(); } });
onBeforeUnmount(() => {
  cancelAnimationFrame(frame); contentObserver?.disconnect(); contentMutationObserver?.disconnect();
  document.removeEventListener("pointerdown", onPointerDown, true); document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true);
});
</script>

<template><div v-if="open" ref="popover" class="floating-popover" :class="{ 'is-positioned': isPositioned }" role="menu"><slot /></div></template>

<style>
.floating-popover { position: absolute; z-index: var(--sketch-z-popover); top: 0; left: 0; box-sizing: border-box; overflow: hidden; padding: 10px; visibility: hidden; border: 1px solid var(--sketch-color-border); border-radius: 20px; background: var(--sketch-color-surface-raised); box-shadow: var(--sketch-shadow-popover); }
.floating-popover.is-positioned { visibility: visible; transition: height var(--sketch-transition-expand), transform var(--sketch-transition-expand); }
</style>
