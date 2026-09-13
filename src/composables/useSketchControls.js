import { closePopover, openPopover } from "./usePopover.js";

export function useSketchControls({ state, clone, pushHistory, render, resizeCanvases, announce, commitText, onRatioChange, getViewScale = () => 1 }) {
  const { activeTool, activeShape, strokeColor, strokeSize, selectedCommand, selectedIndex, activePopover, controlsOutside, canvasRatio } = state;

  function selectTool(tool) {
    if (state.textEditor.value) commitText();
    activeTool.value = tool;
    selectedIndex.value = -1;
    state.selectionCursor.value = "default";
    closePopover();
    render();
    announce(`${{ select: "选择并移动", pen: "画笔", text: "文字", eraser: "橡皮擦" }[tool] || "形状"}已选择`);
  }

  function toggleShapeMenu(anchor) {
    if (state.textEditor.value) commitText();
    activeTool.value = "shape";
    selectedIndex.value = -1;
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
    else openPopover("ratio", anchor, { select: selectCanvasRatio }, { current: canvasRatio.value });
  }

  function selectCanvasRatio(ratio) {
    if (onRatioChange) return onRatioChange(ratio);
    canvasRatio.value = ratio;
    closePopover();
    resizeCanvases();
    announce(`画布比例 ${ratio}`);
  }

  function selectShape(shape) {
    activeShape.value = shape.id;
    activeTool.value = "shape";
    closePopover();
    announce(`${shape.label}已选择`);
  }

  function selectCommand(index) {
    selectedIndex.value = index;
    if (index < 0) state.selectionCursor.value = "default";
    const command = state.commands.value[index];
    if (command?.color) strokeColor.value = command.color;
    if (command && ["shape", "pen"].includes(command.type)) strokeSize.value = command.worldSize ? command.size * getViewScale() : command.size;
  }

  function setStrokeSize(size) {
    strokeSize.value = size;
    const command = selectedCommand.value;
    if (!command || !["shape", "pen"].includes(command.type)) return;
    const commandSize = command.worldSize ? size / getViewScale() : size;
    if (command.size === commandSize) return;
    const previous = clone();
    command.size = commandSize;
    pushHistory(previous);
    announce(`对象粗细 ${size} 像素`);
  }

  function setStrokeColor(color) {
    if (!color || (color === strokeColor.value && selectedCommand.value?.color === color)) return;
    strokeColor.value = color;
    const command = selectedCommand.value;
    if (!command || command.type === "eraser" || command.color === color) return;
    const previous = clone();
    command.color = color;
    pushHistory(previous);
    announce("对象颜色已更新");
  }

  return { selectTool, toggleShapeMenu, toggleControlsOutside, toggleRatioMenu, selectCanvasRatio, selectShape, selectCommand, setStrokeSize, setStrokeColor };
}
