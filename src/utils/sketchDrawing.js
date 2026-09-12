import { getStroke } from "perfect-freehand";

function strokePath(points) {
  if (!points.length) return "";
  const path = points.reduce((result, point, index, list) => {
    const next = list[(index + 1) % list.length];
    result.push(point, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2]);
    return result;
  }, ["M", points[0], "Q"]);
  path.push("Z");
  return path.flat().join(" ");
}

export function prepareContext(context) {
  const dpr = window.devicePixelRatio || 1;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
}

export function drawFreehand(context, command, pixelPoint, preview = false) {
  const input = command.points.map((point) => {
    const pixel = pixelPoint(point);
    return [pixel.x, pixel.y, pixel.pressure];
  });
  const outline = getStroke(input, {
    size: command.size,
    thinning: command.usePressure ? 0.45 : 0,
    smoothing: 0.85,
    streamline: 0.28,
    simulatePressure: false,
    last: true,
  });
  if (!outline.length) return;

  context.save();
  context.globalCompositeOperation = command.type === "eraser" && !preview ? "destination-out" : "source-over";
  context.fillStyle = command.type === "eraser" && preview ? "rgba(168, 168, 168, 0.5)" : command.color;
  context.fill(new Path2D(strokePath(outline)));
  context.restore();
}

export function drawShape(context, command, pixelPoint) {
  const start = pixelPoint(command.start);
  const end = pixelPoint(command.end);
  const width = end.x - start.x;
  const height = end.y - start.y;
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  context.save();
  context.strokeStyle = command.color;
  context.lineWidth = command.size;
  context.beginPath();
  if (command.shape === "ellipse") {
    context.ellipse(start.x + width / 2, start.y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
  } else if (command.shape === "line" || command.shape === "arrow") {
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    if (command.shape === "arrow") {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = Math.min(Math.hypot(width, height) * 0.35, Math.max(14, command.size * 2.2));
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
    }
  } else if (command.shape === "triangle") {
    context.moveTo(centerX, top); context.lineTo(right, bottom); context.lineTo(left, bottom); context.closePath();
  } else if (command.shape === "diamond") {
    context.moveTo(centerX, top); context.lineTo(right, centerY); context.lineTo(centerX, bottom); context.lineTo(left, centerY); context.closePath();
  } else if (command.shape === "star") {
    const points = Array.from({ length: 10 }, (_, index) => {
      const radiusScale = index % 2 === 0 ? 1 : 0.42;
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      return { x: Math.cos(angle) * radiusScale, y: Math.sin(angle) * radiusScale };
    });
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    points.forEach((point, index) => {
      const x = left + ((point.x - minX) / (maxX - minX)) * (right - left);
      const y = top + ((point.y - minY) / (maxY - minY)) * (bottom - top);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.closePath();
  } else if (command.shape === "heart") {
    const shapeWidth = right - left;
    const shapeHeight = bottom - top;
    context.moveTo(centerX, top + shapeHeight * 0.28);
    context.bezierCurveTo(centerX, top + shapeHeight * 0.12, left + shapeWidth * 0.43, top, left + shapeWidth * 0.27, top);
    context.bezierCurveTo(left + shapeWidth * 0.12, top, left, top + shapeHeight * 0.12, left, top + shapeHeight * 0.3);
    context.bezierCurveTo(left, top + shapeHeight * 0.5, left + shapeWidth * 0.08, top + shapeHeight * 0.72, centerX, bottom);
    context.bezierCurveTo(right - shapeWidth * 0.08, top + shapeHeight * 0.72, right, top + shapeHeight * 0.5, right, top + shapeHeight * 0.3);
    context.bezierCurveTo(right, top + shapeHeight * 0.12, right - shapeWidth * 0.12, top, right - shapeWidth * 0.27, top);
    context.bezierCurveTo(right - shapeWidth * 0.43, top, centerX, top + shapeHeight * 0.12, centerX, top + shapeHeight * 0.28);
    context.closePath();
  } else {
    context.rect(start.x, start.y, width, height);
  }
  context.stroke();
  context.restore();
}
