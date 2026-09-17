import { closePopover, openPopover } from "./usePopover.js";
import { locale } from "../locales/index.js";

const copy = locale.sketch;

export function useSketchControls({ state, clone, pushHistory, render, resizeCanvases, announce, commitText, onRatioChange, getCurrentRatio = () => state.canvasRatio.value, getDocumentScale = () => 1 }) {
  const { activeTool, activeShape, strokeColor, strokeSize, selectedCommand, selectedId, activePopover, controlsOutside, canvasRatio } = state;

  function selectTool(tool) {
    if (state.textEditor.value) commitText();
    activeTool.value = tool;
    selectedId.value = null;
    closePopover();
    render();
    announce(copy.messages.toolSelected(copy.tools[tool] || copy.labels.shape));
  }

  function toggleShapeMenu(anchor) {
    if (state.textEditor.value) commitText();
    activeTool.value = "shape";
    selectedId.value = null;
    if (activePopover.value === "shape") closePopover();
    else openPopover("shape", anchor, { select: selectShape }, { activeShape: activeShape.value });
    render();
  }

  function toggleControlsOutside() {
    controlsOutside.value = !controlsOutside.value;
    closePopover();
    resizeCanvases();
  }

  function toggleRatioMenu(anchor) {
    if (activePopover.value === "ratio") closePopover();
    else openPopover("ratio", anchor, { select: selectCanvasRatio }, { current: getCurrentRatio() });
  }

  function selectCanvasRatio(ratio) {
    if (onRatioChange) return onRatioChange(ratio);
    canvasRatio.value = ratio;
    closePopover();
    resizeCanvases();
    announce(copy.messages.canvasRatio(ratio));
  }

  function selectShape(shape) {
    activeShape.value = shape.id;
    activeTool.value = "shape";
    closePopover();
    announce(copy.messages.shapeSelected(shape.label));
  }

  function selectCommand(id) {
    selectedId.value = id;
    const command = state.commands.value.find((item) => item.id === id);
    if (command?.color) strokeColor.value = command.color;
    if (command && ["shape", "pen"].includes(command.type)) strokeSize.value = command.strokeWidth * getDocumentScale();
  }

  function setStrokeSize(size) {
    strokeSize.value = size;
    const command = selectedCommand.value;
    if (!command || !["shape", "pen"].includes(command.type)) return;
    const strokeWidth = size / getDocumentScale();
    if (command.strokeWidth === strokeWidth) return;
    const previous = clone();
    command.strokeWidth = strokeWidth;
    pushHistory(previous);
    announce(copy.messages.objectSize(size));
  }

  function setStrokeColor(color) {
    if (!color || (color === strokeColor.value && selectedCommand.value?.color === color)) return;
    strokeColor.value = color;
    const command = selectedCommand.value;
    if (!command || command.type === "eraser" || command.color === color) return;
    const previous = clone();
    command.color = color;
    pushHistory(previous);
    announce(copy.messages.objectColorUpdated);
  }

  return { selectTool, toggleShapeMenu, toggleControlsOutside, toggleRatioMenu, selectCanvasRatio, selectShape, selectCommand, setStrokeSize, setStrokeColor };
}
