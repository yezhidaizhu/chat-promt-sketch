export function createSketchCamera({ width, height, worldAspect = 1, padding = 48, zoom = 1, pan = { x: 0, y: 0 } }) {
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const fittedScaleY = Math.min(availableWidth / worldAspect, availableHeight);
  const fittedScaleX = worldAspect * fittedScaleY;
  const fittedOffsetX = (width - fittedScaleX) / 2;
  const fittedOffsetY = (height - fittedScaleY) / 2;
  const scaleY = fittedScaleY * zoom;
  const scaleX = worldAspect * scaleY;
  const offsetX = width / 2 + (fittedOffsetX - width / 2) * zoom + pan.x;
  const offsetY = height / 2 + (fittedOffsetY - height / 2) * zoom + pan.y;

  return {
    scale: scaleY,
    scaleX,
    scaleY,
    toScreen(point) {
      return { x: offsetX + point.x * scaleX, y: offsetY + point.y * scaleY, pressure: point.pressure ?? 0.5 };
    },
    toWorld(point) {
      return { x: (point.x - offsetX) / scaleX, y: (point.y - offsetY) / scaleY, pressure: point.pressure ?? 0.5 };
    },
    toWorldDistance(distance) {
      return distance / scaleY;
    },
    toScreenDistance(distance) {
      return distance * scaleY;
    },
    toWorldXDistance(distance) {
      return distance / scaleX;
    },
    toScreenXDistance(distance) {
      return distance * scaleX;
    },
  };
}
