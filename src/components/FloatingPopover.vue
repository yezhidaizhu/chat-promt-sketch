<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({ open: Boolean, anchor: Object, placement: { type: String, default: "auto" }, variant: { type: String, default: "default" } });
const emit = defineEmits(["close"]);
const popover = ref(null);
const isPositioned = ref(false);
let frame;
let contentObserver;
let contentMutationObserver;

function position(fromContentResize = false) {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (!props.open || !props.anchor || !popover.value) return;
    const anchor = props.anchor.getBoundingClientRect();
    const element = popover.value;
    if (fromContentResize === true && element.getAnimations().some((animation) => animation.transitionProperty === "width" || animation.transitionProperty?.startsWith("padding"))) return;
    const parent = element.offsetParent;
    const parentRect = parent?.getBoundingClientRect();
    const scale = parent && parentRect?.width ? parentRect.width / parent.offsetWidth : 1;
    const gap = 8;
    const currentWidth = element.offsetWidth;
    const currentHeight = element.offsetHeight;
    const currentPadding = parseFloat(getComputedStyle(element).paddingTop);
    const targetPadding = parseFloat(getComputedStyle(element).getPropertyValue("--floating-popover-padding"));
    element.style.width = "max-content";
    element.style.height = "auto";
    const paddingDelta = (targetPadding - currentPadding) * 2;
    const width = element.offsetWidth + paddingDelta;
    const height = element.scrollHeight + paddingDelta;
    if (isPositioned.value && (currentWidth !== width || currentHeight !== height || currentPadding !== targetPadding)) {
      element.style.width = `${currentWidth}px`;
      element.style.height = `${currentHeight}px`;
      element.style.padding = `${currentPadding}px`;
      void element.offsetWidth;
      requestAnimationFrame(() => {
        if (props.open && popover.value === element) {
          element.style.width = `${width}px`;
          element.style.height = `${height}px`;
          element.style.padding = `${targetPadding}px`;
        }
      });
    } else {
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.padding = `${targetPadding}px`;
    }
    const originX = parentRect ? parentRect.left : 0;
    const originY = parentRect ? parentRect.top : 0;
    const localAnchor = {
      left: (anchor.left - originX) / scale,
      top: (anchor.top - originY) / scale,
      bottom: (anchor.bottom - originY) / scale,
      width: anchor.width / scale,
      height: anchor.height / scale,
    };
    const minTop = (0 - originY) / scale + gap;
    const maxTop = (window.innerHeight - originY) / scale - height - gap;
    let left;
    let top;
    if (props.placement === "left") {
      const leftPosition = localAnchor.left - gap - width;
      left = leftPosition >= (0 - originX) / scale + gap ? leftPosition : localAnchor.left + localAnchor.width + gap;
      top = Math.min(Math.max(localAnchor.top, minTop), maxTop);
    } else {
      left = Math.min(Math.max((0 - originX) / scale + gap, localAnchor.left + localAnchor.width / 2 - width / 2), (window.innerWidth - originX) / scale - width - gap);
      const fitsBelow = localAnchor.bottom + gap + height <= (window.innerHeight - originY) / scale;
      top = props.placement === "top" || !fitsBelow ? localAnchor.top - gap - height : localAnchor.bottom + gap;
      top = Math.max(minTop, top);
    }
    element.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    requestAnimationFrame(() => { if (props.open) isPositioned.value = true; });
  });
}

function onPointerDown(event) {
  const path = event.composedPath?.() || [];
  if (path.includes(popover.value) || path.includes(props.anchor) || event.target.closest?.("[data-popover-trigger]")) return;
  emit("close");
}

function onKeydown(event) {
  if (event.key === "Escape") { event.preventDefault(); emit("close"); }
}

watch(() => props.open, async (open) => {
  if (open) {
    await nextTick();
    position();
    contentObserver = new ResizeObserver(() => position(true));
    if (popover.value.firstElementChild) contentObserver.observe(popover.value.firstElementChild);
    contentMutationObserver = new MutationObserver(() => {
      contentObserver?.disconnect();
      if (popover.value?.firstElementChild) contentObserver?.observe(popover.value.firstElementChild);
      position();
    });
    contentMutationObserver.observe(popover.value, { childList: true, subtree: true });
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
  } else {
    isPositioned.value = false;
    contentObserver?.disconnect(); contentMutationObserver?.disconnect();
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true);
  }
});

watch(() => props.anchor, async () => { if (props.open) { await nextTick(); position(); } });
onBeforeUnmount(() => {
  cancelAnimationFrame(frame); contentObserver?.disconnect(); contentMutationObserver?.disconnect();
  document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true);
});
</script>

<template><div v-if="open" ref="popover" class="floating-popover" :class="[`is-${variant}`, { 'is-positioned': isPositioned }]" role="menu" @pointerdown.stop><slot /></div></template>

<style>
.floating-popover { --floating-popover-padding: 10px; position: fixed; z-index: 2147483647; inset: auto; top: 0; left: 0; width: max-content; height: auto; box-sizing: border-box; overflow: hidden; margin: 0; padding: var(--floating-popover-padding); visibility: hidden; pointer-events: auto; border: 1px solid var(--sketch-color-border); border-radius: 20px; background: var(--sketch-color-surface-raised); box-shadow: var(--sketch-shadow-popover); }
.floating-popover.is-pill { --floating-popover-padding: var(--sketch-space-1); border-radius: var(--sketch-radius-pill); }
.floating-popover.is-positioned { visibility: visible; transition: width var(--sketch-transition-expand), height var(--sketch-transition-expand), padding var(--sketch-transition-expand), transform var(--sketch-transition-expand); }
</style>
