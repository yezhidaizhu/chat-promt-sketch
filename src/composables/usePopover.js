import { ref, shallowRef } from "vue";

export const activePopover = ref(null);
export const popoverAnchor = ref(null);
export const popoverProps = shallowRef({});
export const popoverHandlers = shallowRef({});

export function openPopover(type, anchor, handlers = {}, props = {}) {
  popoverProps.value = props;
  popoverHandlers.value = handlers;
  popoverAnchor.value = anchor;
  activePopover.value = type;
}

export function closePopover() {
  activePopover.value = null;
  popoverAnchor.value = null;
  popoverProps.value = {};
  popoverHandlers.value = {};
}
