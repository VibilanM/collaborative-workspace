import rough from "roughjs";
import type { Shape, BoundingBox } from "../types";
import { getShapeBounds, getHandlePositions } from "./math";

export interface RenderOptions {
  shapes: Shape[];
  selectedShapeId: string | null;
  draftShape: Shape | null;
  pan: { x: number; y: number };
  zoom: number;
  showGrid: boolean;
  backgroundColor: string;
}

export function renderCanvas(
  canvas: HTMLCanvasElement,
  options: RenderOptions
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const {
    shapes,
    selectedShapeId,
    draftShape,
    pan,
    zoom,
    showGrid,
    backgroundColor,
  } = options;

  // Clear entire canvas
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Excalidraw-style dot grid
  if (showGrid) {
    drawDotGrid(ctx, canvas.width, canvas.height, pan, zoom);
  }

  // Apply camera transformation (pan and zoom)
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  const rc = rough.canvas(canvas);

  // Draw all existing shapes
  for (const shape of shapes) {
    drawShape(ctx, rc, shape);
  }

  // Draw currently drawing draft shape
  if (draftShape) {
    drawShape(ctx, rc, draftShape);
  }

  // Draw selection highlight and handles
  if (selectedShapeId) {
    const selectedShape = shapes.find((s) => s.id === selectedShapeId);
    if (selectedShape) {
      const bounds = getShapeBounds(selectedShape);
      drawSelectionBox(ctx, bounds, zoom);
    }
  }

  ctx.restore();
}

function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number
) {
  const gridSize = 20 * zoom;
  if (gridSize < 10) return; // Don't draw if too small

  const startX = (pan.x % gridSize);
  const startY = (pan.y % gridSize);

  ctx.fillStyle = "#d3d3d8";
  const dotSize = Math.max(1, 1.2 * zoom);

  for (let x = startX; x < width; x += gridSize) {
    for (let y = startY; y < height; y += gridSize) {
      ctx.fillRect(x, y, dotSize, dotSize);
    }
  }
}

function getRoughOptions(shape: Shape) {
  const stroke = shape.strokeColor || "#1e1e1e";
  const bg = shape.backgroundColor && shape.backgroundColor !== "transparent"
    ? shape.backgroundColor
    : undefined;

  let strokeLineDash: number[] | undefined = undefined;
  if (shape.strokeStyle === "dashed") strokeLineDash = [12, 8];
  if (shape.strokeStyle === "dotted") strokeLineDash = [3, 6];

  return {
    stroke,
    strokeWidth: shape.strokeWidth || 2,
    fill: bg,
    fillStyle: (shape.fillStyle || "hachure") as "hachure" | "cross-hatch" | "solid",
    fillWeight: (shape.strokeWidth || 2) / 2,
    hachureGap: 4,
    roughness: shape.roughness ?? 1,
    strokeLineDash,
    seed: shape.seed || 123456,
  };
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  shape: Shape
) {
  ctx.save();
  if (shape.opacity !== undefined && shape.opacity < 100) {
    ctx.globalAlpha = Math.max(0, Math.min(1, shape.opacity / 100));
  }

  const options = getRoughOptions(shape);

  switch (shape.type) {
    case "rectangle": {
      const minX = Math.min(shape.x, shape.x + shape.width);
      const minY = Math.min(shape.y, shape.y + shape.height);
      const w = Math.abs(shape.width);
      const h = Math.abs(shape.height);
      rc.rectangle(minX, minY, w, h, options);
      break;
    }

    case "diamond": {
      const minX = Math.min(shape.x, shape.x + shape.width);
      const minY = Math.min(shape.y, shape.y + shape.height);
      const w = Math.abs(shape.width);
      const h = Math.abs(shape.height);
      const points: [number, number][] = [
        [minX + w / 2, minY],
        [minX + w, minY + h / 2],
        [minX + w / 2, minY + h],
        [minX, minY + h / 2],
      ];
      rc.polygon(points, options);
      break;
    }

    case "circle": {
      const r = Math.abs(shape.radius);
      rc.circle(shape.x, shape.y, r * 2, options);
      break;
    }

    case "line": {
      rc.line(shape.x1, shape.y1, shape.x2, shape.y2, options);
      break;
    }

    case "arrow": {
      rc.line(shape.x1, shape.y1, shape.x2, shape.y2, options);
      // Arrowhead
      const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
      const headLen = Math.max(14, (shape.strokeWidth || 2) * 5);
      const p1X = shape.x2 - headLen * Math.cos(angle - Math.PI / 6);
      const p1Y = shape.y2 - headLen * Math.sin(angle - Math.PI / 6);
      const p2X = shape.x2 - headLen * Math.cos(angle + Math.PI / 6);
      const p2Y = shape.y2 - headLen * Math.sin(angle + Math.PI / 6);
      rc.line(shape.x2, shape.y2, p1X, p1Y, options);
      rc.line(shape.x2, shape.y2, p2X, p2Y, options);
      break;
    }

    case "freedraw": {
      if (shape.points.length > 1) {
        rc.curve(shape.points, options);
      }
      break;
    }

    case "text": {
      const fontSize = shape.fontSize || 20;
      ctx.font = `${fontSize}px 'Virgil', 'Comic Sans MS', 'Chalkboard SE', 'Segoe UI', cursive, sans-serif`;
      ctx.fillStyle = shape.strokeColor || "#1e1e1e";
      ctx.textBaseline = "top";
      ctx.fillText(shape.text, shape.x, shape.y);
      break;
    }
  }

  ctx.restore();
}

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  bounds: BoundingBox,
  zoom: number
) {
  const padding = 6 / zoom;
  const minX = bounds.minX - padding;
  const minY = bounds.minY - padding;
  const maxX = bounds.maxX + padding;
  const maxY = bounds.maxY + padding;
  const width = maxX - minX;
  const height = maxY - minY;

  ctx.save();
  ctx.strokeStyle = "#6965db"; // Excalidraw signature selection purple
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.strokeRect(minX, minY, width, height);

  // Draw resize handles
  const handleSize = 8 / zoom;
  const handles = getHandlePositions({
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
  });

  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#6965db";
  ctx.lineWidth = 1.5 / zoom;

  for (const pos of Object.values(handles) as { x: number; y: number }[]) {
    ctx.fillRect(
      pos.x - handleSize / 2,
      pos.y - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      pos.x - handleSize / 2,
      pos.y - handleSize / 2,
      handleSize,
      handleSize
    );
  }

  ctx.restore();
}
