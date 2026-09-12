export function useSketchPointer(options) {
  const {
    activeTool, activeShape, strokeColor, strokeSize, activePopover, commands, selectedIndex, selectedCommand, selectionCursor,
    clone, pushHistory, announce, selectCommand, findResizeHandle, findCommand, selectionBounds, geometryBounds, resizeCommand,
    translateCommand, normalizePoint, pixelPoint, eventPoint, render, renderLive, renderEraserPreview, startText, beginTextEdit,
    updatePointerCursor, getResizeCursor, hitSelectionFrame,
  } = options;
  let gesture = null;

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    activePopover.value = null;
    const point = eventPoint(event);
    updatePointerCursor(point);
    if (activeTool.value === "text") { gesture = { type: "text", point }; return; }
    if (activeTool.value === "select") {
      const resizeHandle = findResizeHandle(point, event.pointerType);
      if (resizeHandle) {
        const command = commands.value[selectedIndex.value];
        gesture = { type: "resize", handle: resizeHandle, previous: clone(), originalCommand: clone(command), originalBounds: ["shape", "pen"].includes(command.type) ? geometryBounds(command) : selectionBounds(command), originalSelectionBounds: selectionBounds(command), moved: false };
        selectionCursor.value = getResizeCursor(resizeHandle);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const hitIndex = hitSelectionFrame(selectedCommand.value, point, selectionBounds) ? selectedIndex.value : findCommand(point);
      selectCommand(hitIndex);
      gesture = selectedIndex.value >= 0 ? { type: "move", start: point, last: normalizePoint(point), previous: clone(), moved: false } : null;
      selectionCursor.value = selectedIndex.value >= 0 ? "grabbing" : "default";
      if (gesture) event.currentTarget.setPointerCapture(event.pointerId);
      render();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const normalized = normalizePoint(point);
    gesture = { type: activeTool.value, previous: clone(), command: activeTool.value === "shape" ? { type: "shape", shape: activeShape.value, start: normalized, end: normalized, color: strokeColor.value, size: strokeSize.value } : { type: activeTool.value, points: [normalized], color: strokeColor.value, size: strokeSize.value, usePressure: activeTool.value === "pen" && event.pointerType === "pen" } };
  }

  function onCanvasDoubleClick(event) {
    if (activeTool.value !== "select") return;
    const index = findCommand(eventPoint(event));
    if (commands.value[index]?.type !== "text") return;
    event.preventDefault(); gesture = null; beginTextEdit(index);
  }

  function onPointerMove(event) {
    const point = eventPoint(event); updatePointerCursor(point);
    if (!gesture) {
      if (activeTool.value === "select") {
        const handle = findResizeHandle(point, event.pointerType);
        const hoveredIndex = findCommand(point);
        selectionCursor.value = handle ? getResizeCursor(handle) : hitSelectionFrame(selectedCommand.value, point, selectionBounds) ? "grab" : hoveredIndex >= 0 ? "grab" : "default";
      }
      return;
    }
    if (gesture.type === "text") return;
    if (gesture.type === "move") {
      const normalized = normalizePoint(point);
      if (!gesture.moved && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) < 4) return;
      translateCommand(commands.value[selectedIndex.value], normalized.x - gesture.last.x, normalized.y - gesture.last.y);
      gesture.last = normalized; gesture.moved = true; selectionCursor.value = "grabbing"; render(); return;
    }
    if (gesture.type === "resize") { resizeCommand(commands.value[selectedIndex.value], point, gesture); gesture.moved = true; render(); return; }
    if (gesture.type === "shape") gesture.command.end = normalizePoint(point);
    else (event.getCoalescedEvents?.() || [event]).forEach((pointerEvent) => gesture.command.points.push(normalizePoint(eventPoint(pointerEvent))));
    if (gesture.type === "eraser") renderEraserPreview(gesture.command); else renderLive(gesture.command);
  }

  function finishPointer(event, cancelled = false) {
    if (!gesture) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) { if (["move", "resize"].includes(gesture.type)) commands.value = gesture.previous; gesture = null; selectionCursor.value = selectedIndex.value >= 0 ? "grab" : "default"; render(); return; }
    if (gesture.type === "text") { const { point } = gesture; gesture = null; startText(point); return; }
    if (["move", "resize"].includes(gesture.type)) {
      if (gesture.moved) { pushHistory(gesture.previous); announce(gesture.type === "resize" ? "对象大小已调整" : "对象已移动"); }
    } else {
      const command = gesture.command;
      if (["pen", "eraser"].includes(command.type)) {
        const endPoint = normalizePoint(eventPoint(event)); const lastPoint = command.points.at(-1);
        if (Math.hypot(endPoint.x - lastPoint.x, endPoint.y - lastPoint.y) > 0.0001) command.points.push(endPoint);
      }
      const start = command.type === "shape" ? pixelPoint(command.start) : null;
      const end = command.type === "shape" ? pixelPoint(command.end) : null;
      if (command.type !== "shape" || Math.hypot(end.x - start.x, end.y - start.y) > 3) {
        commands.value.push(command); pushHistory(gesture.previous);
        if (command.type === "shape") { activeTool.value = "select"; selectedIndex.value = commands.value.length - 1; selectionCursor.value = "grab"; render(); }
        announce("内容已添加");
      } else render();
    }
    gesture = null;
    if (activeTool.value === "select") selectionCursor.value = selectedIndex.value >= 0 ? "grab" : "default";
  }

  function onCanvasLeave() {
    options.pointerCursor.value.visible = false;
    if (!gesture) selectionCursor.value = "default";
  }

  return { onPointerDown, onCanvasDoubleClick, onPointerMove, finishPointer, onCanvasLeave };
}
