export type RectangleShape = {
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CircleShape = {
  id: string;
  type: "circle";
  x: number;
  y: number;
  radius: number;
};

export type LineShape = {
  id: string;
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type Shape =
  | RectangleShape
  | CircleShape
  | LineShape;

export type CanvasDocument = {
  version: 1;
  shapes: Shape[];
};