import { isCommandHit } from "../utils/hitTest.js";

export function useSketchSelection({ commands, selectedIndex, pixelPoint, textLayout, displaySize = (command) => command.size }) {
  function commandBounds(command) {
    if (command.type === "text") {
      const point = pixelPoint(command); const layout = textLayout(command);
      return { x: point.x, y: point.y, width: layout.width, height: layout.height };
    }
    const points = (command.type === "shape" ? [command.start, command.end] : command.points).map(pixelPoint);
    const xs = points.map((point) => point.x); const ys = points.map((point) => point.y); const padding = Math.max(displaySize(command) / 2 + 1, 8);
    return { x: Math.min(...xs) - padding, y: Math.min(...ys) - padding, width: Math.max(...xs) - Math.min(...xs) + padding * 2, height: Math.max(...ys) - Math.min(...ys) + padding * 2 };
  }

  function geometryBounds(command) {
    if (command.type === "text") return commandBounds(command);
    if (command.type === "shape") {
      const start = pixelPoint(command.start); const end = pixelPoint(command.end);
      return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
    }
    if (command.type === "pen") {
      const points = command.points.map(pixelPoint); const xs = points.map((point) => point.x); const ys = points.map((point) => point.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    return commandBounds(command);
  }

  function selectionBounds(command) {
    const bounds = geometryBounds(command); const padding = ["shape", "pen"].includes(command.type) ? displaySize(command) / 2 + 1 : 0;
    return { x: bounds.x - padding, y: bounds.y - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2 };
  }

  function selectionHandles(command) {
    if (!command || !["shape", "text", "pen"].includes(command.type)) return [];
    if (command.type === "shape" && ["line", "arrow"].includes(command.shape)) return [{ id: "start", ...pixelPoint(command.start) }, { id: "end", ...pixelPoint(command.end) }];
    const bounds = selectionBounds(command);
    return [["nw", bounds.x, bounds.y], ["n", bounds.x + bounds.width / 2, bounds.y], ["ne", bounds.x + bounds.width, bounds.y], ["e", bounds.x + bounds.width, bounds.y + bounds.height / 2], ["se", bounds.x + bounds.width, bounds.y + bounds.height], ["s", bounds.x + bounds.width / 2, bounds.y + bounds.height], ["sw", bounds.x, bounds.y + bounds.height], ["w", bounds.x, bounds.y + bounds.height / 2]].map(([id, x, y]) => ({ id, x, y }));
  }

  function findResizeHandle(point, pointerType = "mouse") {
    const command = commands.value[selectedIndex.value]; const hitRadius = pointerType === "touch" ? 22 : 12;
    return selectionHandles(command).find((handle) => Math.hypot(point.x - handle.x, point.y - handle.y) <= hitRadius) || null;
  }

  function resizeBounds(bounds, handleId, point) {
    let left = bounds.x; let right = bounds.x + bounds.width; let top = bounds.y; let bottom = bounds.y + bounds.height;
    if (handleId.includes("w")) left = point.x; if (handleId.includes("e")) right = point.x; if (handleId.includes("n")) top = point.y; if (handleId.includes("s")) bottom = point.y;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function findCommand(point) {
    for (let index = commands.value.length - 1; index >= 0; index -= 1) {
      const command = commands.value[index];
      const displayCommand = command.worldSize ? { ...command, size: displaySize(command) } : command;
      if (command.type !== "eraser" && isCommandHit(displayCommand, point, pixelPoint, commandBounds)) return index;
    }
    return -1;
  }

  function drawSelection(context) {
    const command = commands.value[selectedIndex.value]; if (!command) return;
    const bounds = selectionBounds(command); context.save(); context.strokeStyle = "#2c67c5"; context.lineWidth = 1.5; context.setLineDash([5, 5]);
    if (!(command.type === "shape" && ["line", "arrow"].includes(command.shape))) context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.setLineDash([]); selectionHandles(command).forEach((handle) => { context.fillStyle = "#ffffff"; context.strokeStyle = "#2c67c5"; context.lineWidth = 2; context.beginPath(); context.rect(handle.x - 5, handle.y - 5, 10, 10); context.fill(); context.stroke(); }); context.restore();
  }

  return { commandBounds, geometryBounds, selectionBounds, selectionHandles, findResizeHandle, resizeBounds, findCommand, drawSelection };
}
