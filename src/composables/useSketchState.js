import { computed, ref } from "vue";
import { activePopover, popoverAnchor } from "./usePopover.js";
import { useSketchPreferences } from "./useSketchPreferences.js";

export function useSketchState() {
  const activeTool = ref("pen");
  const activeShape = ref("rectangle");
  const { strokeColor, strokeSize, controlsOutside, canvasRatio, backgroundColor } = useSketchPreferences();
  const commands = ref([]);
  const selectedIndex = ref(-1);
  const textEditor = ref(null);
  const textValue = ref("");
  const selectionCursor = ref("default");
  const selectedCommand = computed(() => commands.value[selectedIndex.value] || null);
  const hasContent = computed(() => commands.value.length > 0);
  return { activeTool, activeShape, strokeColor, strokeSize, backgroundColor, commands, selectedIndex, activePopover, popoverAnchor, controlsOutside, canvasRatio, textEditor, textValue, selectionCursor, selectedCommand, hasContent };
}
