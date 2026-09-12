<script setup>
import { computed } from "vue";
import FloatingPopover from "./FloatingPopover.vue";
import ClearConfirm from "./sketch/ClearConfirm.vue";
import RatioMenu from "./sketch/RatioMenu.vue";
import ShapeMenu from "./sketch/ShapeMenu.vue";
import { activePopover, popoverAnchor, popoverHandlers, popoverProps, closePopover } from "../composables/usePopover.js";

const content = computed(() => {
  if (activePopover.value === "shape") return ShapeMenu;
  if (activePopover.value === "ratio") return RatioMenu;
  if (activePopover.value === "clear") return ClearConfirm;
  return null;
});

function dispatch(event, value) {
  popoverHandlers.value[event]?.(value);
}
</script>

<template>
  <Teleport to="#sketch-popover-host">
    <FloatingPopover :open="Boolean(content)" :anchor="popoverAnchor" @close="closePopover">
      <component :is="content" v-bind="popoverProps" @select="dispatch('select', $event)" @confirm="dispatch('confirm', $event)" @cancel="dispatch('cancel', $event)" />
    </FloatingPopover>
  </Teleport>
</template>
