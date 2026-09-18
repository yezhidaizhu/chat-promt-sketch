export function rectCenter(bounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function rotatePoint(point, center, angle = 0) {
  if (!angle) return { ...point };
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return {
    ...point,
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  };
}

export function inverseRotatePoint(point, center, angle = 0) {
  return rotatePoint(point, center, -angle);
}

export function rotatedRectBounds(bounds, angle = 0) {
  if (!angle) return { ...bounds };
  const center = rectCenter(bounds);
  const points = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, angle));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
