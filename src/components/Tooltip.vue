<script setup>
// 暂不使用。当前保留浏览器原生 title 提示，后续不要引入此组件。
import { computed, inject, nextTick, onBeforeUnmount, ref } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  delay: { type: Number, default: 450 },
  placement: { type: String, default: "top" },
});

const trigger = ref(null);
const tooltip = ref(null);
const visible = ref(false);
const position = ref({ left: 0, top: 0, side: "top" });
const teleportTarget = inject("TeleportTarget", "body");
let timer;
let frame;

const tooltipStyle = computed(() => ({ left: `${position.value.left}px`, top: `${position.value.top}px` }));

function updatePosition() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const anchor = trigger.value?.getBoundingClientRect();
    const tip = tooltip.value?.getBoundingClientRect();
    if (!anchor || !tip) return;
    const gap = 8;
    const viewportPadding = 8;
    if (props.placement === "right") {
      const side = anchor.right + gap + tip.width <= window.innerWidth - viewportPadding || anchor.left < tip.width + gap + viewportPadding ? "right" : "left";
      position.value = {
        left: Math.round(side === "right" ? anchor.right + gap : anchor.left - gap),
        top: Math.round(Math.min(Math.max(anchor.top + anchor.height / 2, tip.height / 2 + viewportPadding), window.innerHeight - tip.height / 2 - viewportPadding)),
        side,
      };
      return;
    }
    const side = anchor.top >= tip.height + gap + viewportPadding ? "top" : "bottom";
    position.value = {
      left: Math.round(Math.min(Math.max(anchor.left + anchor.width / 2, tip.width / 2 + viewportPadding), window.innerWidth - tip.width / 2 - viewportPadding)),
      top: Math.round(side === "top" ? anchor.top - gap : anchor.bottom + gap),
      side,
    };
  });
}

async function show(delay = props.delay) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    visible.value = true;
    await nextTick();
    updatePosition();
  }, delay);
}

function hide() {
  clearTimeout(timer);
  visible.value = false;
}

onBeforeUnmount(() => {
  clearTimeout(timer);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <span ref="trigger" class="tooltip-trigger" @pointerenter="show()" @pointerleave="hide" @focusin="show(0)" @focusout="hide">
    <slot />
  </span>
  <Teleport :to="teleportTarget">
    <span v-if="visible" ref="tooltip" class="tooltip chat-sketch-canvas-tooltip" :class="`is-${position.side}`" :style="tooltipStyle" role="tooltip">{{ label }}</span>
  </Teleport>
</template>

<style scoped>
.tooltip-trigger { display: inline-flex; }
.tooltip { position: fixed; z-index: var(--sketch-z-tooltip); max-width: min(240px, calc(100vw - 16px)); padding: 5px 8px; pointer-events: none; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 6px; background: rgba(24, 24, 24, 0.96); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.32); color: var(--sketch-color-text); font-size: 11px; font-weight: 600; line-height: 1.25; white-space: nowrap; -webkit-font-smoothing: antialiased; transform: translate(-50%, -100%); animation: tooltip-enter var(--sketch-transition-fast); }
.tooltip::after { position: absolute; width: 6px; height: 6px; border-right: inherit; border-bottom: inherit; background: inherit; content: ""; transform: rotate(45deg); }
.tooltip.is-top { transform: translate(-50%, -100%); }
.tooltip.is-top::after { bottom: -4px; left: calc(50% - 3px); }
.tooltip.is-bottom { transform: translate(-50%, 0); }
.tooltip.is-bottom::after { top: -4px; left: calc(50% - 3px); transform: rotate(225deg); }
.tooltip.is-right { transform: translate(0, -50%); }
.tooltip.is-right::after { top: calc(50% - 3px); left: -4px; transform: rotate(135deg); }
.tooltip.is-left { transform: translate(-100%, -50%); }
.tooltip.is-left::after { top: calc(50% - 3px); right: -4px; transform: rotate(-45deg); }
@keyframes tooltip-enter { from { opacity: 0; } to { opacity: 1; } }
</style>
