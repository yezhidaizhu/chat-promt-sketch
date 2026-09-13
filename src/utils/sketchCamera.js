export function createSketchCamera({ width, height, worldAspect = 1, padding = 48 }) {
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const scaleY = Math.min(availableWidth / worldAspect, availableHeight);
  const scaleX = worldAspect * scaleY;
  const offsetX = (width - scaleX) / 2;
  const offsetY = (height - scaleY) / 2;

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
