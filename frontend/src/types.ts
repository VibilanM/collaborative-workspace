export type FillStyle = "hachure" | "cross-hatch" | "solid";
export type StrokeStyle = "solid" | "dashed" | "dotted";

export type BaseShape = {
  id: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: FillStyle;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  roughness?: number;
  opacity?: number;
  seed?: number;
};

export type RectangleShape = BaseShape & {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CircleShape = BaseShape & {
  type: "circle";
  x: number;
  y: number;
  radius: number;
};

export type LineShape = BaseShape & {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type DiamondShape = BaseShape & {
  type: "diamond";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ArrowShape = BaseShape & {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type FreehandShape = BaseShape & {
  type: "freedraw";
  points: [number, number][];
};

export type TextShape = BaseShape & {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize?: number;
};

export type Shape =
  | RectangleShape
  | CircleShape
  | LineShape
  | DiamondShape
  | ArrowShape
  | FreehandShape
  | TextShape;

export type Tool =
  | "select"
  | "hand"
  | "rectangle"
  | "diamond"
  | "circle"
  | "arrow"
  | "line"
  | "draw"
  | "text"
  | "eraser";

export type CanvasDocument = {
  version: 1;
  shapes: Shape[];
  appState?: {
    viewBackgroundColor?: string;
    grid?: boolean;
  };
};

export type ResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};