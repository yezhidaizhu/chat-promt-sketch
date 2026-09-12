import { computed, ref } from "vue";

export function useSketchState() {
  const activeTool = ref("pen");
  const activeShape = ref("rectangle");
  const strokeColor = ref("#ffffff");
  const strokeSize = ref(13);
  const commands = ref([]);
  const selectedIndex = ref(-1);
  const activePopover = ref(null);
  const popoverAnchor = ref(null);
  const controlsOutside = ref(false);
  const canvasRatio = ref("1:1");
  const textEditor = ref(null);
  const textValue = ref("");
  const selectionCursor = ref("default");
  const selectedCommand = computed(() => commands.value[selectedIndex.value] || null);
  const hasContent = computed(() => commands.value.length > 0);
  return { activeTool, activeShape, strokeColor, strokeSize, commands, selectedIndex, activePopover, popoverAnchor, controlsOutside, canvasRatio, textEditor, textValue, selectionCursor, selectedCommand, hasContent };
}
