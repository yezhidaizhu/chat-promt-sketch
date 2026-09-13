import { computed, ref } from "vue";

export function useHistory(getCommands, onRestore, onCommit = () => {}, getContext = () => null) {
  const undoStack = ref([]);
  const redoStack = ref([]);
  const clone = (value = getCommands()) => JSON.parse(JSON.stringify(value));
  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  const snapshot = (commands = getCommands(), context = getContext()) => ({ commands: clone(commands), context: clone(context) });

  function pushHistory(previous, previousContext = getContext()) {
    undoStack.value.push(snapshot(previous, previousContext));
    redoStack.value = [];
    onCommit();
  }
  function undo() {
    if (!canUndo.value) return false;
    redoStack.value.push(snapshot());
    const previous = undoStack.value.pop();
    onRestore(previous.commands, "已撤销", previous.context);
    return true;
  }
  function redo() {
    if (!canRedo.value) return false;
    undoStack.value.push(snapshot());
    const next = redoStack.value.pop();
    onRestore(next.commands, "已重做", next.context);
    return true;
  }
  return { undoStack, redoStack, canUndo, canRedo, clone, pushHistory, undo, redo };
}
