import { isCommandHit } from "../utils/hitTest.js";
import { rectCenter, rotatePoint, rotatedRectBounds } from "../utils/sketchGeometry.js";

const selectionContrast = "rgba(0, 0, 0, 0.68)";
const textSelectionPadding = 6;

function drawSelectionHandle(context, handle) {
  context.save();
  context.beginPath();
  context.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0, 0, 0, 0.38)";
  context.shadowBlur = 3;
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = selectionContrast;
  context.lineWidth = 1;
  context.stroke();
  context.restore();
}

export function useSketchSelection({ commands, selectedIndex, pixelPoint, textLayout, getStageSize, displaySize = (command) => command.size }) {
  function commandBounds(command) {
    if (command.type === "text") {
      const point = pixelPoint(command); const layout = textLayout(command);
      return { x: point.x, y: point.y, width: layout.width, height: layout.height };
    }
    if (command.type === "image") {
      const start = pixelPoint(command);
      const end = pixelPoint({ x: command.x + command.width, y: command.y + command.height });
      return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
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
    const bounds = geometryBounds(command);
    const padding = command.type === "text" ? textSelectionPadding : ["shape", "pen"].includes(command.type) ? displaySize(command) / 2 + 1 : 0;
    return { x: bounds.x - padding, y: bounds.y - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2 };
  }

  function selectionHandles(command) {
    if (!command || !["shape", "text", "pen", "image"].includes(command.type)) return [];
    if (command.type === "shape" && ["line", "arrow"].includes(command.shape)) return [{ id: "start", ...pixelPoint(command.start) }, { id: "end", ...pixelPoint(command.end) }];
    const bounds = selectionBounds(command);
    const center = rectCenter(bounds);
    const rotation = command.rotation || 0;
    const handles = [["nw", bounds.x, bounds.y], ["n", center.x, bounds.y], ["ne", bounds.x + bounds.width, bounds.y], ["e", bounds.x + bounds.width, center.y], ["se", bounds.x + bounds.width, bounds.y + bounds.height], ["s", center.x, bounds.y + bounds.height], ["sw", bounds.x, bounds.y + bounds.height], ["w", bounds.x, center.y]].map(([id, x, y]) => ({ id, rotation, ...rotatePoint({ x, y }, center, rotation) }));
    const placeAbove = bounds.y + bounds.height + 50 > getStageSize().height;
    handles.push({ id: "rotate", anchor: placeAbove ? "top" : "bottom", ...rotatePoint({ x: center.x, y: placeAbove ? bounds.y - 34 : bounds.y + bounds.height + 34 }, center, rotation) });
    return handles;
  }

  function findResizeHandle(point, pointerType = "mouse") {
    const command = commands.value[selectedIndex.value]; const hitRadius = pointerType === "touch" ? 22 : 12;
    return selectionHandles(command).find((handle) => Math.hypot(point.x - handle.x, point.y - handle.y) <= hitRadius) || null;
  }

  function resizeBounds(bounds, handleId, point, preserveAspect = false) {
    let left = bounds.x; let right = bounds.x + bounds.width; let top = bounds.y; let bottom = bounds.y + bounds.height;
    if (preserveAspect && bounds.width && bounds.height) {
      const aspect = bounds.width / bounds.height;
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      if (handleId.length === 2) {
        const anchorX = handleId.includes("w") ? right : left;
        const anchorY = handleId.includes("n") ? bottom : top;
        let dx = point.x - anchorX;
        let dy = point.y - anchorY;
        const signX = Math.sign(dx) || (handleId.includes("w") ? -1 : 1);
        const signY = Math.sign(dy) || (handleId.includes("n") ? -1 : 1);
        if (Math.abs(dx) / bounds.width >= Math.abs(dy) / bounds.height) dy = signY * Math.abs(dx) / aspect;
        else dx = signX * Math.abs(dy) * aspect;
        point = { x: anchorX + dx, y: anchorY + dy };
      } else if (["e", "w"].includes(handleId)) {
        const anchorX = handleId === "w" ? right : left;
        const height = Math.abs(point.x - anchorX) / aspect;
        top = centerY - height / 2;
        bottom = centerY + height / 2;
      } else if (["n", "s"].includes(handleId)) {
        const anchorY = handleId === "n" ? bottom : top;
        const width = Math.abs(point.y - anchorY) * aspect;
        left = centerX - width / 2;
        right = centerX + width / 2;
      }
    }
    if (handleId.includes("w")) left = point.x; if (handleId.includes("e")) right = point.x; if (handleId.includes("n")) top = point.y; if (handleId.includes("s")) bottom = point.y;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function findCommand(point) {
    for (let index = commands.value.length - 1; index >= 0; index -= 1) {
      const command = commands.value[index];
      const displayCommand = command.worldSize && command.size != null && command.type !== "text" ? { ...command, size: displaySize(command), worldSize: false } : command;
      if (command.type !== "eraser" && isCommandHit(displayCommand, point, pixelPoint, commandBounds)) return index;
    }
    return -1;
  }

  function rotatedSelectionBounds(command) {
    return rotatedRectBounds(selectionBounds(command), command.rotation || 0);
  }

  function drawSelection(context) {
    const command = commands.value[selectedIndex.value];
    if (!command || command.type !== "shape" || !["line", "arrow"].includes(command.shape)) return;
    context.save();
    selectionHandles(command).forEach((handle) => drawSelectionHandle(context, handle));
    context.restore();
  }

  return { commandBounds, geometryBounds, selectionBounds, rotatedSelectionBounds, selectionHandles, findResizeHandle, resizeBounds, findCommand, drawSelection };
}
