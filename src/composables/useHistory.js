import { computed, ref } from "vue";

export function useHistory(getCommands, onRestore, onCommit = () => {}) {
  const undoStack = ref([]);
  const redoStack = ref([]);
  const clone = (value = getCommands()) => JSON.parse(JSON.stringify(value));
  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  function pushHistory(previous) {
    undoStack.value.push(previous);
    redoStack.value = [];
    onCommit();
  }
  function undo() {
    if (!canUndo.value) return false;
    redoStack.value.push(clone());
    onRestore(undoStack.value.pop(), "已撤销");
    return true;
  }
  function redo() {
    if (!canRedo.value) return false;
    undoStack.value.push(clone());
    onRestore(redoStack.value.pop(), "已重做");
    return true;
  }
  return { undoStack, redoStack, canUndo, canRedo, clone, pushHistory, undo, redo };
}
