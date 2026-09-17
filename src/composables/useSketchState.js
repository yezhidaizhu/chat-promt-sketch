import { computed, ref } from "vue";
import { activePopover, popoverAnchor } from "./usePopover.js";
import { useSketchPreferences } from "./useSketchPreferences.js";

export function useSketchState() {
  const activeTool = ref("pen");
  const activeShape = ref("rectangle");
  const { strokeColor, strokeSize, controlsOutside, canvasRatio, backgroundColor } = useSketchPreferences();
  const commands = ref([]);
  const selectedId = ref(null);
  const textEditor = ref(null);
  const textValue = ref("");
  const selectedCommand = computed(() => commands.value.find((command) => command.id === selectedId.value) || null);
  const hasContent = computed(() => commands.value.length > 0);
  return { activeTool, activeShape, strokeColor, strokeSize, backgroundColor, commands, selectedId, activePopover, popoverAnchor, controlsOutside, canvasRatio, textEditor, textValue, selectedCommand, hasContent };
}
