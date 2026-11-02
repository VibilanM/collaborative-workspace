import type {
  Shape,
  BoundingBox,
  ResizeHandle,
  CanvasDocument,
} from "../types";

export function createId(): string {
  return crypto.randomUUID();
}

export function createSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

export function getShapeBounds(shape: Shape): BoundingBox {
  switch (shape.type) {
    case "rectangle":
    case "diamond": {
      const minX = Math.min(shape.x, shape.x + shape.width);
      const minY = Math.min(shape.y, shape.y + shape.height);
      const width = Math.abs(shape.width);
      const height = Math.abs(shape.height);
      return { minX, minY, maxX: minX + width, maxY: minY + height, width, height };
    }

    case "circle": {
      const r = Math.abs(shape.radius);
      return {
        minX: shape.x - r,
        minY: shape.y - r,
        maxX: shape.x + r,
        maxY: shape.y + r,
        width: r * 2,
        height: r * 2,
      };
    }

    case "line":
    case "arrow": {
      const minX = Math.min(shape.x1, shape.x2);
      const minY = Math.min(shape.y1, shape.y2);
      const maxX = Math.max(shape.x1, shape.x2);
      const maxY = Math.max(shape.y1, shape.y2);
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    case "freedraw": {
      if (!shape.points.length) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [x, y] of shape.points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    case "text": {
      const fontSize = shape.fontSize || 22;
      const lines = (shape.text || "").split("\n");
      const lineHeight = fontSize * 1.25;
      let maxLineWidth = 0;
      for (const line of lines) {
        const lineWidth = Math.max(24, line.length * (fontSize * 0.62));
        if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
      }
      const width = maxLineWidth;
      const height = Math.max(lineHeight, lines.length * lineHeight);
      return {
        minX: shape.x,
        minY: shape.y,
        maxX: shape.x + width,
        maxY: shape.y + height,
        width,
        height,
      };
    }
  }
}

export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return Math.hypot(px - projX, py - projY);
}

export function isPointInShape(
  px: number,
  py: number,
  shape: Shape,
  tolerance = 8
): boolean {
  const bounds = getShapeBounds(shape);

  // Quick bounding box check with padding
  if (
    px < bounds.minX - tolerance ||
    px > bounds.maxX + tolerance ||
    py < bounds.minY - tolerance ||
    py > bounds.maxY + tolerance
  ) {
    return false;
  }

  switch (shape.type) {
    case "rectangle":
      return (
        px >= bounds.minX - tolerance &&
        px <= bounds.maxX + tolerance &&
        py >= bounds.minY - tolerance &&
        py <= bounds.maxY + tolerance
      );

    case "diamond": {
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      const rx = bounds.width / 2;
      const ry = bounds.height / 2;
      if (rx === 0 || ry === 0) return false;
      return Math.abs(px - cx) / rx + Math.abs(py - cy) / ry <= 1.05;
    }

    case "circle": {
      const r = Math.abs(shape.radius);
      return Math.hypot(px - shape.x, py - shape.y) <= r + tolerance;
    }

    case "line":
    case "arrow":
      return (
        distanceToSegment(px, py, shape.x1, shape.y1, shape.x2, shape.y2) <=
        tolerance + (shape.strokeWidth || 2)
      );

    case "freedraw": {
      for (let i = 0; i < shape.points.length - 1; i++) {
        const [x1, y1] = shape.points[i];
        const [x2, y2] = shape.points[i + 1];
        if (
          distanceToSegment(px, py, x1, y1, x2, y2) <=
          tolerance + (shape.strokeWidth || 2)
        ) {
          return true;
        }
      }
      return false;
    }

    case "text":
      return (
        px >= bounds.minX - tolerance &&
        px <= bounds.maxX + tolerance &&
        py >= bounds.minY - tolerance &&
        py <= bounds.maxY + tolerance
      );
  }
}

export function getHandlePositions(
  bounds: BoundingBox
): Record<ResizeHandle, { x: number; y: number }> {
  const { minX, minY, maxX, maxY } = bounds;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  return {
    nw: { x: minX, y: minY },
    n: { x: midX, y: minY },
    ne: { x: maxX, y: minY },
    e: { x: maxX, y: midY },
    se: { x: maxX, y: maxY },
    s: { x: midX, y: maxY },
    sw: { x: minX, y: maxY },
    w: { x: minX, y: midY },
  };
}

export function getHandleAtPoint(
  px: number,
  py: number,
  bounds: BoundingBox,
  handleSize = 10
): ResizeHandle | null {
  const handles = getHandlePositions(bounds);
  for (const [handle, pos] of Object.entries(handles) as [
    ResizeHandle,
    { x: number; y: number },
  ][]) {
    if (
      Math.abs(px - pos.x) <= handleSize &&
      Math.abs(py - pos.y) <= handleSize
    ) {
      return handle;
    }
  }
  return null;
}

export function moveShape(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.type) {
    case "rectangle":
    case "diamond":
    case "text":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };

    case "circle":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };

    case "line":
    case "arrow":
      return {
        ...shape,
        x1: shape.x1 + dx,
        y1: shape.y1 + dy,
        x2: shape.x2 + dx,
        y2: shape.y2 + dy,
      };

    case "freedraw":
      return {
        ...shape,
        points: shape.points.map(([x, y]) => [x + dx, y + dy]),
      };
  }
}

export function resizeShape(
  shape: Shape,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  initialShape: Shape
): Shape {
  switch (shape.type) {
    case "rectangle":
    case "diamond": {
      const orig = initialShape as typeof shape;
      let x = orig.x;
      let y = orig.y;
      let width = orig.width;
      let height = orig.height;

      if (handle.includes("e")) width += dx;
      if (handle.includes("s")) height += dy;
      if (handle.includes("w")) {
        x += dx;
        width -= dx;
      }
      if (handle.includes("n")) {
        y += dy;
        height -= dy;
      }

      return { ...shape, x, y, width, height };
    }

    case "circle": {
      const orig = initialShape as typeof shape;
      const delta = Math.max(Math.abs(dx), Math.abs(dy));
      const factor = handle.includes("e") || handle.includes("s") ? 1 : -1;
      const radius = Math.max(5, orig.radius + factor * delta);
      return { ...shape, radius };
    }

    case "line":
    case "arrow": {
      const orig = initialShape as typeof shape;
      if (handle === "nw" || handle === "w" || handle === "n") {
        return { ...shape, x1: orig.x1 + dx, y1: orig.y1 + dy };
      }
      return { ...shape, x2: orig.x2 + dx, y2: orig.y2 + dy };
    }

    case "text":
    case "freedraw":
      return shape;
  }
}

export function isValidDocument(value: unknown): value is CanvasDocument {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Record<string, unknown>;
  if (doc.version !== 1 || !Array.isArray(doc.shapes)) return false;

  const ids = new Set<string>();
  for (const raw of doc.shapes) {
    if (typeof raw !== "object" || raw === null) return false;
    const s = raw as Record<string, unknown>;
    if (typeof s.id !== "string" || !s.id || ids.has(s.id)) return false;
    ids.add(s.id);
    if (typeof s.type !== "string") return false;
  }
  return true;
}

