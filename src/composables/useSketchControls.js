export function useSketchControls({ state, clone, pushHistory, render, resizeCanvases, announce, commitText }) {
  const { activeTool, activeShape, strokeColor, strokeSize, selectedCommand, selectedIndex, activePopover, popoverAnchor, controlsOutside, canvasRatio } = state;

  function selectTool(tool) {
    if (state.textEditor.value) commitText();
    activeTool.value = tool;
    selectedIndex.value = -1;
    state.selectionCursor.value = "default";
    activePopover.value = null;
    render();
    announce(`${{ select: "选择并移动", pen: "画笔", text: "文字", eraser: "橡皮擦" }[tool] || "形状"}已选择`);
  }

  function toggleShapeMenu(anchor) {
    if (state.textEditor.value) commitText();
    activeTool.value = "shape";
    selectedIndex.value = -1;
    activePopover.value = activePopover.value === "shape" ? null : "shape";
    popoverAnchor.value = anchor;
    render();
  }

  function toggleControlsOutside() {
    controlsOutside.value = !controlsOutside.value;
    activePopover.value = null;
    resizeCanvases();
  }

  function toggleRatioMenu(anchor) {
    activePopover.value = activePopover.value === "ratio" ? null : "ratio";
    popoverAnchor.value = anchor;
  }

  function selectCanvasRatio(ratio) {
    canvasRatio.value = ratio;
    activePopover.value = null;
    resizeCanvases();
    announce(`画布比例 ${ratio}`);
  }

  function selectShape(shape) {
    activeShape.value = shape.id;
    activeTool.value = "shape";
    activePopover.value = null;
    announce(`${shape.label}已选择`);
  }

  function selectCommand(index) {
    selectedIndex.value = index;
    if (index < 0) state.selectionCursor.value = "default";
    const command = state.commands.value[index];
    if (command?.color) strokeColor.value = command.color;
    if (command && ["shape", "pen"].includes(command.type)) strokeSize.value = command.size;
  }

  function setStrokeSize(size) {
    strokeSize.value = size;
    const command = selectedCommand.value;
    if (!command || !["shape", "pen"].includes(command.type) || command.size === size) return;
    const previous = clone();
    command.size = size;
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
