<script setup>
import { computed } from "vue";
import FloatingPopover from "./FloatingPopover.vue";
import ClearConfirm from "./sketch/ClearConfirm.vue";
import BackgroundColorMenu from "./sketch/BackgroundColorMenu.vue";
import RatioMenu from "./sketch/RatioMenu.vue";
import ShapeMenu from "./sketch/ShapeMenu.vue";
import ViewControlsMenu from "./sketch/ViewControlsMenu.vue";
import { activePopover, popoverAnchor, popoverHandlers, popoverProps, closePopover } from "../composables/usePopover.js";

const content = computed(() => {
  if (activePopover.value === "shape") return ShapeMenu;
  if (activePopover.value === "ratio") return RatioMenu;
  if (activePopover.value === "clear") return ClearConfirm;
  if (activePopover.value === "background") return BackgroundColorMenu;
  if (activePopover.value === "view") return ViewControlsMenu;
  return null;
});

function dispatch(event, value) {
  popoverHandlers.value[event]?.(value);
}
</script>

<template>
  <Teleport to="#sketch-popover-host">
    <FloatingPopover :open="Boolean(content)" :anchor="popoverAnchor" :placement="activePopover === 'clear' ? 'top' : ['view', 'background', 'ratio'].includes(activePopover) ? 'left' : 'auto'" :variant="activePopover === 'view' ? 'pill' : 'default'" @close="closePopover">
      <component :is="content" v-bind="popoverProps" @preview="dispatch('preview', $event)" @select="dispatch('select', $event)" @confirm="dispatch('confirm', $event)" @cancel="dispatch('cancel', $event)" @toggle-pan="dispatch('togglePan')" @zoom-in="dispatch('zoomIn')" @zoom-out="dispatch('zoomOut')" @reset="dispatch('reset')" />
    </FloatingPopover>
  </Teleport>
</template>
