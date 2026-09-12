function mapPoint(point, oldSize, newSize, center, scale) {
  return {
    ...point,
    x: ((point.x * oldSize.width - center.x) * scale + newSize.width / 2) / newSize.width,
    y: ((point.y * oldSize.height - center.y) * scale + newSize.height / 2) / newSize.height,
  };
}

export function fitContentToCanvas(commands, oldSize, newSize, bounds, padding = 40) {
  if (!commands.length || !bounds) return;
  const scale = Math.min(1, (newSize.width - padding * 2) / Math.max(bounds.width, 1), (newSize.height - padding * 2) / Math.max(bounds.height, 1));
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  commands.forEach((command) => {
    if (command.type === "text") {
      Object.assign(command, mapPoint(command, oldSize, newSize, center, scale));
    } else if (command.type === "shape") {
      command.start = mapPoint(command.start, oldSize, newSize, center, scale);
      command.end = mapPoint(command.end, oldSize, newSize, center, scale);
    } else command.points = command.points.map((point) => mapPoint(point, oldSize, newSize, center, scale));
    if (typeof command.size === "number") command.size *= scale;
  });
}
