export function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

export function isCommandHit(command, point, pixelPoint, commandBounds) {
  if (command.type === "text") {
    const bounds = commandBounds(command);
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }
  const hitDistance = Math.max(command.size / 2 + 6, 8);
  if (command.type === "shape" && ["line", "arrow"].includes(command.shape)) {
    return pointToSegmentDistance(point, pixelPoint(command.start), pixelPoint(command.end)) <= hitDistance;
  }
  if (command.type === "pen") {
    const points = command.points.map(pixelPoint);
    return points.some((current, index) => {
      const previous = points[index - 1];
      return previous ? pointToSegmentDistance(point, previous, current) <= hitDistance : Math.hypot(point.x - current.x, point.y - current.y) <= hitDistance;
    });
  }
  const bounds = commandBounds(command);
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

export function isSelectionFrameHit(command, point, selectionBounds) {
  if (!command || (command.type === "shape" && ["line", "arrow"].includes(command.shape))) return false;
  const bounds = selectionBounds(command);
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

export function resizeCursor(handle) {
  if (!handle) return "default";
  if (["nw", "se"].includes(handle.id)) return "nwse-resize";
  if (["ne", "sw"].includes(handle.id)) return "nesw-resize";
  if (["n", "s"].includes(handle.id)) return "ns-resize";
  if (["e", "w"].includes(handle.id)) return "ew-resize";
  return "crosshair";
}
