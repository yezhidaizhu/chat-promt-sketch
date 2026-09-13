export function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

function polylineHit(point, points, distance, closed = true) {
  return points.some((current, index) => {
    const next = points[index + 1] || (closed ? points[0] : null);
    return next && pointToSegmentDistance(point, current, next) <= distance;
  });
}

function shapeOutlineHit(command, point, pixelPoint, distance) {
  const start = pixelPoint(command.start);
  const end = pixelPoint(command.end);
  const left = Math.min(start.x, end.x); const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y); const bottom = Math.max(start.y, end.y);
  const centerX = (left + right) / 2; const centerY = (top + bottom) / 2;

  if (command.shape === "ellipse") {
    const radiusX = (right - left) / 2; const radiusY = (bottom - top) / 2;
    if (!radiusX || !radiusY) return pointToSegmentDistance(point, start, end) <= distance;
    const radius = Math.hypot((point.x - centerX) / radiusX, (point.y - centerY) / radiusY);
    return Math.abs(radius - 1) * Math.min(radiusX, radiusY) <= distance;
  }

  if (command.shape === "triangle") return polylineHit(point, [{ x: centerX, y: top }, { x: right, y: bottom }, { x: left, y: bottom }], distance);
  if (command.shape === "diamond") return polylineHit(point, [{ x: centerX, y: top }, { x: right, y: centerY }, { x: centerX, y: bottom }, { x: left, y: centerY }], distance);
  if (command.shape === "star") {
    const normalized = Array.from({ length: 10 }, (_, index) => {
      const radiusScale = index % 2 === 0 ? 1 : 0.42;
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      return { x: Math.cos(angle) * radiusScale, y: Math.sin(angle) * radiusScale };
    });
    const minX = Math.min(...normalized.map((item) => item.x)); const maxX = Math.max(...normalized.map((item) => item.x));
    const minY = Math.min(...normalized.map((item) => item.y)); const maxY = Math.max(...normalized.map((item) => item.y));
    return polylineHit(point, normalized.map((item) => ({ x: left + ((item.x - minX) / (maxX - minX)) * (right - left), y: top + ((item.y - minY) / (maxY - minY)) * (bottom - top) })), distance);
  }
  if (command.shape === "heart") return polylineHit(point, [{ x: centerX, y: top + (bottom - top) * 0.28 }, { x: left, y: top + (bottom - top) * 0.3 }, { x: centerX, y: bottom }, { x: right, y: top + (bottom - top) * 0.3 }], distance);
  return polylineHit(point, [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }], distance);
}

export function isCommandHit(command, point, pixelPoint, commandBounds) {
  if (command.type === "text") {
    const bounds = commandBounds(command);
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }
  const hitDistance = Math.max(command.size / 2 + 6, 8);
  if (command.type === "shape") {
    if (["line", "arrow"].includes(command.shape)) return pointToSegmentDistance(point, pixelPoint(command.start), pixelPoint(command.end)) <= hitDistance;
    return shapeOutlineHit(command, point, pixelPoint, hitDistance);
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
