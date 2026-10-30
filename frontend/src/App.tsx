import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CanvasDocument, Shape } from "./types";
import "./App.css";

type Tool = "select" | "rectangle" | "circle" | "line";

const WIDTH = 1000;
const HEIGHT = 700;

function createId(): string {
  return crypto.randomUUID();
}

function pointerPosition(
  event: ReactPointerEvent<SVGSVGElement>
) {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

function moveShape(
  shape: Shape,
  dx: number,
  dy: number
): Shape {
  switch (shape.type) {
    case "rectangle":
    case "circle":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };

    case "line":
      return {
        ...shape,
        x1: shape.x1 + dx,
        y1: shape.y1 + dy,
        x2: shape.x2 + dx,
        y2: shape.y2 + dy,
      };
  }
}

function isValidDocument(value: unknown): value is CanvasDocument {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const doc = value as Record<string, unknown>;

  if (
    doc.version !== 1 ||
    !Array.isArray(doc.shapes)
  ) {
    return false;
  }

  const ids = new Set<string>();

  for (const raw of doc.shapes) {
    if (
      typeof raw !== "object" ||
      raw === null
    ) {
      return false;
    }

    const s = raw as Record<string, unknown>;

    if (
      typeof s.id !== "string" ||
      s.id.length === 0 ||
      ids.has(s.id)
    ) {
      return false;
    }

    ids.add(s.id);

    const number = (key: string) =>
      typeof s[key] === "number" &&
      Number.isFinite(s[key]);

    if (s.type === "rectangle") {
      if (
        !number("x") ||
        !number("y") ||
        !number("width") ||
        !number("height") ||
        (s.width as number) < 0 ||
        (s.height as number) < 0
      ) {
        return false;
      }
    } else if (s.type === "circle") {
      if (
        !number("x") ||
        !number("y") ||
        !number("radius") ||
        (s.radius as number) < 0
      ) {
        return false;
      }
    } else if (s.type === "line") {
      if (
        !number("x1") ||
        !number("y1") ||
        !number("x2") ||
        !number("y2")
      ) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
}

function ShapeView({
  shape,
  selected,
}: {
  shape: Shape;
  selected: boolean;
}) {
  const common = {
    stroke: selected ? "#2563eb" : "#202124",
    strokeWidth: selected ? 3 : 2,
    fill: "transparent",
    vectorEffect: "non-scaling-stroke" as const,
  };

  switch (shape.type) {
    case "rectangle":
      return (
        <rect
          {...common}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
        />
      );

    case "circle":
      return (
        <circle
          {...common}
          cx={shape.x}
          cy={shape.y}
          r={shape.radius}
        />
      );

    case "line":
      return (
        <line
          {...common}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
        />
      );
  }
}

export default function App() {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [message, setMessage] = useState("");

  const svgRef = useRef<SVGSVGElement>(null);

  const drawingRef = useRef<{
    startX: number;
    startY: number;
    draftId: string;
    tool: Exclude<Tool, "select">;
  } | null>(null);

  const draggingRef = useRef<{
    lastX: number;
    lastY: number;
    shapeId: string;
  } | null>(null);

  function handlePointerDown(
    event: ReactPointerEvent<SVGSVGElement>
  ) {
    if (event.button !== 0) return;

    const { x, y } = pointerPosition(event);
    const target = event.target as Element;
    const shapeElement = target.closest("[data-shape-id]");
    const shapeId = shapeElement?.getAttribute("data-shape-id");

    if (tool === "select") {
      if (shapeId) {
        setSelectedId(shapeId);

        draggingRef.current = {
          lastX: x,
          lastY: y,
          shapeId,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
      } else {
        setSelectedId(null);
      }

      return;
    }

    const id = createId();

    drawingRef.current = {
      startX: x,
      startY: y,
      draftId: id,
      tool,
    };

    setSelectedId(id);

    const initialShape: Shape =
      tool === "rectangle"
        ? {
            id,
            type: "rectangle",
            x,
            y,
            width: 0,
            height: 0,
          }
        : tool === "circle"
          ? {
              id,
              type: "circle",
              x,
              y,
              radius: 0,
            }
          : {
              id,
              type: "line",
              x1: x,
              y1: y,
              x2: x,
              y2: y,
            };

    setShapes((previous) => [...previous, initialShape]);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(
    event: ReactPointerEvent<SVGSVGElement>
  ) {
    const { x, y } = pointerPosition(event);

    if (drawingRef.current) {
      const drawing = drawingRef.current;
      const dx = x - drawing.startX;
      const dy = y - drawing.startY;

      setShapes((previous) =>
        previous.map((shape) => {
          if (shape.id !== drawing.draftId) return shape;

          switch (drawing.tool) {
            case "rectangle":
              return {
                id: shape.id,
                type: "rectangle",
                x: Math.min(drawing.startX, x),
                y: Math.min(drawing.startY, y),
                width: Math.abs(dx),
                height: Math.abs(dy),
              };

            case "circle":
              return {
                id: shape.id,
                type: "circle",
                x: drawing.startX,
                y: drawing.startY,
                radius: Math.hypot(dx, dy),
              };

            case "line":
              return {
                id: shape.id,
                type: "line",
                x1: drawing.startX,
                y1: drawing.startY,
                x2: x,
                y2: y,
              };
          }
        })
      );

      return;
    }

    if (draggingRef.current) {
      const dragging = draggingRef.current;
      const dx = x - dragging.lastX;
      const dy = y - dragging.lastY;

      dragging.lastX = x;
      dragging.lastY = y;

      if (dx === 0 && dy === 0) return;

      setShapes((previous) =>
        previous.map((shape) =>
          shape.id === dragging.shapeId
            ? moveShape(shape, dx, dy)
            : shape
        )
      );
    }
  }

  function handlePointerUp() {
    if (drawingRef.current) {
      const draft = drawingRef.current;

      setShapes((previous) =>
        previous.filter((shape) => {
          if (shape.id !== draft.draftId) return true;

          if (shape.type === "rectangle") {
            return shape.width > 0 && shape.height > 0;
          }

          if (shape.type === "circle") {
            return shape.radius > 0;
          }

          return shape.x1 !== shape.x2 || shape.y1 !== shape.y2;
        })
      );

      drawingRef.current = null;
    }

    draggingRef.current = null;
  }

  function deleteSelected() {
    if (!selectedId) return;

    setShapes((previous) =>
      previous.filter((shape) => shape.id !== selectedId)
    );

    setSelectedId(null);
  }

  function exportJSON() {
    const document: CanvasDocument = {
      version: 1,
      shapes,
    };

    const json = JSON.stringify(document, null, 2);
    setJsonText(json);

    const blob = new Blob([json], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");

    link.href = url;
    link.download = "whiteboard.json";
    link.click();

    URL.revokeObjectURL(url);
    setMessage("JSON exported.");
  }

  async function importJSON(file: File) {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (!isValidDocument(parsed)) {
        throw new Error("Invalid whiteboard document format.");
      }

      setShapes(parsed.shapes);
      setSelectedId(null);
      setJsonText(JSON.stringify(parsed, null, 2));
      setMessage("Whiteboard loaded successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the file."
      );
    }
  }

  function loadFromText() {
    try {
      const parsed: unknown = JSON.parse(jsonText);

      if (!isValidDocument(parsed)) {
        throw new Error("Invalid whiteboard document format.");
      }

      setShapes(parsed.shapes);
      setSelectedId(null);
      setMessage("Whiteboard restored from JSON.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Invalid JSON."
      );
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>
  ) {
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      selectedId
    ) {
      event.preventDefault();
      deleteSelected();
    }
  }

  return (
    <main className="workspace" onKeyDown={handleKeyDown} tabIndex={0}>
      <header className="topbar">
        <div>
          <h1>Collaborative Workspace</h1>
          <p>Module 3 · Local whiteboard</p>
        </div>

        <div className="toolbar">
          {(["select", "rectangle", "circle", "line"] as Tool[]).map(
            (item) => (
              <button
                key={item}
                className={tool === item ? "active" : ""}
                onClick={() => setTool(item)}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            )
          )}

          <button
            onClick={deleteSelected}
            disabled={!selectedId}
          >
            Delete
          </button>

          <button onClick={exportJSON}>Export JSON</button>

          <label className="file-button">
            Load JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) void importJSON(file);

                event.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      <section className="canvas-panel">
        <div className="canvas-heading">
          <span>Whiteboard</span>
          <span>{shapes.length} shapes</span>
        </div>

        <svg
          ref={svgRef}
          className="canvas"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >
          <defs>
            <pattern
              id="grid"
              width="25"
              height="25"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 25 0 L 0 0 0 25"
                fill="none"
                stroke="#e9edf2"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect
            width={WIDTH}
            height={HEIGHT}
            fill="url(#grid)"
            pointerEvents="none"
          />

          {shapes.map((shape) => (
            <g
              key={shape.id}
              data-shape-id={shape.id}
              style={{
                cursor: tool === "select" ? "move" : "crosshair",
              }}
            >
              <ShapeView
                shape={shape}
                selected={shape.id === selectedId}
              />
            </g>
          ))}
        </svg>
      </section>

      <section className="json-panel">
        <div className="canvas-heading">
          <span>Document JSON</span>
          <button onClick={loadFromText}>Load from editor</button>
        </div>

        <textarea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder="Export your drawing to inspect its JSON, or paste JSON here and load it."
          spellCheck={false}
        />

        <p className="status" role="status">{message}</p>
      </section>
    </main>
  );
}