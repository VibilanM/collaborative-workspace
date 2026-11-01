import { useState, useRef, useEffect, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  Shape,
  Tool,
  CanvasDocument,
  ResizeHandle,
  FillStyle,
  StrokeStyle,
} from "./types";
import {
  createId,
  createSeed,
  getShapeBounds,
  isPointInShape,
  getHandleAtPoint,
  moveShape,
  resizeShape,
  isValidDocument,
} from "./utils/math";
import { renderCanvas } from "./utils/renderer";
import { Toolbar } from "./components/Toolbar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { BottomControls } from "./components/BottomControls";
import { JsonTab } from "./components/JsonTab";
import "./App.css";

export default function App() {
  // Determine DEV or PROD mode (reads from backend .env via Vite define, or frontend env, or URL ?mode=...)
  const backendEnvMode = (import.meta.env.VITE_BACKEND_MODE || "").toUpperCase();
  const frontendEnvMode = (import.meta.env.VITE_APP_MODE || "").toUpperCase();
  const [previewMode, setPreviewMode] = useState<"DEV" | "PROD">(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qMode = urlParams.get("mode")?.toUpperCase();
    if (qMode === "PROD" || qMode === "DEV") return qMode;
    if (backendEnvMode === "PROD" || frontendEnvMode === "PROD") return "PROD";
    return "DEV";
  });

  const isDevMode = previewMode === "DEV";

  // Whiteboard Canvas State
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [isLocked, setIsLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Viewport camera (Pan & Zoom)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [canvasBg, setCanvasBg] = useState<string>("#ffffff");

  // History for Undo / Redo
  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Default drawing properties (Excalidraw styling)
  const [currentStyles, setCurrentStyles] = useState({
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "hachure" as FillStyle,
    strokeWidth: 2,
    strokeStyle: "solid" as StrokeStyle,
    roughness: 1,
    opacity: 100,
  });

  // DEV Mode JSON tab state
  const [realTimeSync, setRealTimeSync] = useState(true);
  const [manualJsonText, setManualJsonText] = useState("");
  const [manualStatusMessage, setManualStatusMessage] = useState("");

  const liveJson = JSON.stringify(
    {
      version: 1,
      shapes,
      appState: {
        viewBackgroundColor: canvasBg,
        grid: showGrid,
      },
    },
    null,
    2
  );

  const jsonText = realTimeSync ? liveJson : manualJsonText;
  const statusMessage = realTimeSync
    ? `Real-time synced (${shapes.length} ${shapes.length === 1 ? "shape" : "shapes"})`
    : manualStatusMessage;

  // In-line text editing
  const [editingText, setEditingText] = useState<{
    id: string;
    x: number;
    y: number;
    text: string;
    isNew: boolean;
  } | null>(null);

  // Refs for canvas and gestures
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draftShapeRef = useRef<Shape | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialShapeStateRef = useRef<Shape | null>(null);
  const resizeHandleRef = useRef<ResizeHandle | null>(null);
  const isPanningRef = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Push state to undo/redo history
  const pushHistory = useCallback(
    (newShapes: Shape[]) => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        next.push(newShapes);
        return next;
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (canUndo) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setShapes(history[targetIndex]);
      setSelectedId(null);
    }
  }, [canUndo, historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setShapes(history[targetIndex]);
      setSelectedId(null);
    }
  }, [canRedo, historyIndex, history]);

  // Convert viewport screen coordinates to canvas space coordinates
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      return {
        x: (screenX - pan.x) / zoom,
        y: (screenY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Main canvas render call
  const triggerRender = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCanvas(canvas, {
      shapes,
      selectedShapeId: selectedId,
      draftShape: draftShapeRef.current,
      pan,
      zoom,
      showGrid,
      backgroundColor: canvasBg,
    });
  }, [shapes, selectedId, pan, zoom, showGrid, canvasBg]);

  // Resize canvas to match window
  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      triggerRender();
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [triggerRender]);

  useEffect(() => {
    triggerRender();
  }, [triggerRender]);

  // Pointer Down (Mouse / Touch)
  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    // Only handle primary click
    if (e.button !== 0 && e.button !== 1) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    dragStartRef.current = { x, y };

    // Handle middle click or spacebar pan
    if (e.button === 1 || isSpacePressed || tool === "hand") {
      isPanningRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Eraser Tool
    if (tool === "eraser") {
      const hitShape = [...shapes].reverse().find((s) => isPointInShape(x, y, s));
      if (hitShape) {
        const nextShapes = shapes.filter((s) => s.id !== hitShape.id);
        setShapes(nextShapes);
        pushHistory(nextShapes);
        if (selectedId === hitShape.id) setSelectedId(null);
      }
      return;
    }

    // Select Tool
    if (tool === "select") {
      // 1. Check if clicking on a resize handle of the selected shape
      if (selectedId) {
        const selectedShape = shapes.find((s) => s.id === selectedId);
        if (selectedShape) {
          const bounds = getShapeBounds(selectedShape);
          const handle = getHandleAtPoint(x, y, bounds, 12 / zoom);
          if (handle) {
            resizeHandleRef.current = handle;
            initialShapeStateRef.current = { ...selectedShape };
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      // 2. Check if clicking on an existing shape
      const hitShape = [...shapes].reverse().find((s) => isPointInShape(x, y, s));
      if (hitShape) {
        setSelectedId(hitShape.id);
        isDraggingRef.current = true;
        initialShapeStateRef.current = { ...hitShape };
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        setSelectedId(null);
      }
      return;
    }

    // Text Tool
    if (tool === "text") {
      setEditingText({
        id: createId(),
        x,
        y,
        text: "",
        isNew: true,
      });
      if (!isLocked) setTool("select");
      return;
    }

    // Shape Creation Tools (Rectangle, Diamond, Circle, Line, Arrow, Draw)
    const newId = createId();
    const seed = createSeed();
    const commonProps = {
      id: newId,
      seed,
      ...currentStyles,
    };

    let initialDraft: Shape;
    switch (tool) {
      case "rectangle":
        initialDraft = { ...commonProps, type: "rectangle", x, y, width: 0, height: 0 };
        break;
      case "diamond":
        initialDraft = { ...commonProps, type: "diamond", x, y, width: 0, height: 0 };
        break;
      case "circle":
        initialDraft = { ...commonProps, type: "circle", x, y, radius: 0 };
        break;
      case "arrow":
        initialDraft = { ...commonProps, type: "arrow", x1: x, y1: y, x2: x, y2: y };
        break;
      case "line":
        initialDraft = { ...commonProps, type: "line", x1: x, y1: y, x2: x, y2: y };
        break;
      case "draw":
        initialDraft = { ...commonProps, type: "freedraw", points: [[x, y]] };
        break;
      default:
        return;
    }

    draftShapeRef.current = initialDraft;
    e.currentTarget.setPointerCapture(e.pointerId);
    triggerRender();
  }

  // Pointer Move
  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    // Panning canvas
    if (isPanningRef.current) {
      setPan((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
      return;
    }

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    // Eraser dragging
    if (tool === "eraser" && e.buttons === 1) {
      const hitShape = [...shapes].reverse().find((s) => isPointInShape(x, y, s));
      if (hitShape) {
        const nextShapes = shapes.filter((s) => s.id !== hitShape.id);
        setShapes(nextShapes);
        pushHistory(nextShapes);
        if (selectedId === hitShape.id) setSelectedId(null);
      }
      return;
    }

    // Resizing shape via handle
    if (resizeHandleRef.current && selectedId && initialShapeStateRef.current) {
      const handle = resizeHandleRef.current;
      const dx = x - dragStartRef.current.x;
      const dy = y - dragStartRef.current.y;

      setShapes((prev) =>
        prev.map((s) =>
          s.id === selectedId
            ? resizeShape(s, handle, dx, dy, initialShapeStateRef.current!)
            : s
        )
      );
      return;
    }

    // Dragging selected shape
    if (isDraggingRef.current && selectedId) {
      const dx = x - dragStartRef.current.x;
      const dy = y - dragStartRef.current.y;
      dragStartRef.current = { x, y };

      setShapes((prev) =>
        prev.map((s) => (s.id === selectedId ? moveShape(s, dx, dy) : s))
      );
      return;
    }

    // Drawing draft shape
    if (draftShapeRef.current) {
      const draft = draftShapeRef.current;
      const start = dragStartRef.current;

      switch (draft.type) {
        case "rectangle":
        case "diamond":
          draftShapeRef.current = {
            ...draft,
            x: Math.min(start.x, x),
            y: Math.min(start.y, y),
            width: Math.abs(x - start.x),
            height: Math.abs(y - start.y),
          };
          break;

        case "circle":
          draftShapeRef.current = {
            ...draft,
            radius: Math.hypot(x - start.x, y - start.y),
          };
          break;

        case "line":
        case "arrow":
          draftShapeRef.current = {
            ...draft,
            x2: x,
            y2: y,
          };
          break;

        case "freedraw":
          draftShapeRef.current = {
            ...draft,
            points: [...draft.points, [x, y]],
          };
          break;
      }

      triggerRender();
    }
  }

  // Pointer Up
  function handlePointerUp() {
    isPanningRef.current = false;

    // Resizing finished
    if (resizeHandleRef.current) {
      resizeHandleRef.current = null;
      initialShapeStateRef.current = null;
      pushHistory(shapes);
      return;
    }

    // Dragging finished
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      initialShapeStateRef.current = null;
      pushHistory(shapes);
      return;
    }

    // Creating shape finished
    if (draftShapeRef.current) {
      const draft = draftShapeRef.current;
      draftShapeRef.current = null;

      let isValid = false;
      if (draft.type === "rectangle" || draft.type === "diamond") {
        isValid = draft.width > 3 && draft.height > 3;
      } else if (draft.type === "circle") {
        isValid = draft.radius > 3;
      } else if (draft.type === "line" || draft.type === "arrow") {
        isValid = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 4;
      } else if (draft.type === "freedraw") {
        isValid = draft.points.length > 1;
      }

      if (isValid) {
        const nextShapes = [...shapes, draft];
        setShapes(nextShapes);
        pushHistory(nextShapes);
        setSelectedId(draft.id);

        if (!isLocked) {
          setTool("select");
        }
      } else {
        triggerRender();
      }
    }
  }

  // Wheel Zoom & Pan
  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered on cursor
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(3, Math.max(0.1, zoom * zoomFactor));

      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
      });
      setZoom(newZoom);
    } else {
      // Pan
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }

  // Keyboard actions ref for stable listener
  const keyboardRef = useRef({
    handleUndo,
    handleRedo,
    handleDuplicate: () => {},
    handleDeleteSelected: () => {},
    handleBringToFront: () => {},
    handleSendToBack: () => {},
    selectedId,
    setTool,
  });

  // Keyboard Shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // If typing in input/textarea, ignore shortcuts
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (e.code === "Space") {
        setIsSpacePressed(true);
      }

      const actions = keyboardRef.current;

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.handleRedo();
        else actions.handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        actions.handleRedo();
        return;
      }

      // Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        actions.handleDuplicate();
        return;
      }

      // Delete
      if ((e.key === "Delete" || e.key === "Backspace") && actions.selectedId) {
        e.preventDefault();
        actions.handleDeleteSelected();
        return;
      }

      // Bring forward / send backward
      if (e.key === "]" && actions.selectedId) {
        actions.handleBringToFront();
        return;
      }
      if (e.key === "[" && actions.selectedId) {
        actions.handleSendToBack();
        return;
      }

      // Tool switches
      switch (e.key.toLowerCase()) {
        case "h":
          actions.setTool("hand");
          break;
        case "1":
        case "v":
          actions.setTool("select");
          break;
        case "2":
        case "r":
          actions.setTool("rectangle");
          break;
        case "3":
        case "d":
          actions.setTool("diamond");
          break;
        case "4":
        case "c":
          actions.setTool("circle");
          break;
        case "5":
        case "a":
          actions.setTool("arrow");
          break;
        case "6":
        case "l":
          actions.setTool("line");
          break;
        case "7":
        case "p":
          actions.setTool("draw");
          break;
        case "8":
        case "t":
          actions.setTool("text");
          break;
        case "0":
        case "e":
          actions.setTool("eraser");
          break;
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Selected Shape and Property Updates
  const selectedShape = shapes.find((s) => s.id === selectedId) || null;

  function handleUpdateStyle(updates: Partial<Shape>) {
    setCurrentStyles((prev) => ({ ...prev, ...updates }));

    if (selectedId) {
      const nextShapes = shapes.map((s) =>
        s.id === selectedId ? ({ ...s, ...updates } as Shape) : s
      );
      setShapes(nextShapes);
      pushHistory(nextShapes);
    }
  }

  const handleDuplicate = useCallback(() => {
    if (!selectedId) return;
    const target = shapes.find((s) => s.id === selectedId);
    if (!target) return;

    const newShape = moveShape(
      { ...target, id: createId(), seed: createSeed() },
      25,
      25
    );
    const nextShapes = [...shapes, newShape];
    setShapes(nextShapes);
    setSelectedId(newShape.id);
    pushHistory(nextShapes);
  }, [selectedId, shapes, pushHistory]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    const nextShapes = shapes.filter((s) => s.id !== selectedId);
    setShapes(nextShapes);
    setSelectedId(null);
    pushHistory(nextShapes);
  }, [selectedId, shapes, pushHistory]);

  const handleBringToFront = useCallback(() => {
    if (!selectedId) return;
    const item = shapes.find((s) => s.id === selectedId);
    if (!item) return;
    const next = [...shapes.filter((s) => s.id !== selectedId), item];
    setShapes(next);
    pushHistory(next);
  }, [selectedId, shapes, pushHistory]);

  const handleSendToBack = useCallback(() => {
    if (!selectedId) return;
    const item = shapes.find((s) => s.id === selectedId);
    if (!item) return;
    const next = [item, ...shapes.filter((s) => s.id !== selectedId)];
    setShapes(next);
    pushHistory(next);
  }, [selectedId, shapes, pushHistory]);

  // Update keyboard actions ref on every render
  useEffect(() => {
    keyboardRef.current = {
      handleUndo,
      handleRedo,
      handleDuplicate,
      handleDeleteSelected,
      handleBringToFront,
      handleSendToBack,
      selectedId,
      setTool,
    };
  }, [
    handleUndo,
    handleRedo,
    handleDuplicate,
    handleDeleteSelected,
    handleBringToFront,
    handleSendToBack,
    selectedId,
  ]);

  function handleClearCanvas() {
    setShapes([]);
    setSelectedId(null);
    pushHistory([]);
  }

  // Export JSON (Downloads the file)
  function handleDownloadJson() {
    const doc: CanvasDocument = {
      version: 1,
      shapes,
      appState: {
        viewBackgroundColor: canvasBg,
        grid: showGrid,
      },
    };
    const json = JSON.stringify(doc, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "whiteboard.json";
    link.click();
    URL.revokeObjectURL(url);
    setManualStatusMessage("whiteboard.json downloaded successfully.");
  }

  // Import JSON
  async function handleImportJson(file: File) {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isValidDocument(parsed)) {
        throw new Error("Invalid whiteboard document format.");
      }
      setShapes(parsed.shapes);
      setSelectedId(null);
      pushHistory(parsed.shapes);
      if (parsed.appState?.viewBackgroundColor) {
        setCanvasBg(parsed.appState.viewBackgroundColor);
      }
      if (parsed.appState?.grid !== undefined) {
        setShowGrid(parsed.appState.grid);
      }
      setManualStatusMessage("Whiteboard loaded successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load JSON file");
    }
  }

  // Export PNG Image
  function handleExportImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "whiteboard.png";
    link.click();
  }

  // Apply JSON from Editor (DEV mode)
  function handleApplyJsonFromEditor() {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (!isValidDocument(parsed)) {
        throw new Error("Invalid whiteboard format: check version & shapes.");
      }
      setShapes(parsed.shapes);
      setSelectedId(null);
      pushHistory(parsed.shapes);
      setManualStatusMessage("Applied JSON to whiteboard successfully.");
    } catch (err) {
      setManualStatusMessage(
        err instanceof Error ? `Error: ${err.message}` : "Invalid JSON."
      );
    }
  }

  // Save in-place text shape
  function handleSaveText(textValue: string) {
    if (!editingText) return;
    const trimmed = textValue.trim();
    if (trimmed.length > 0) {
      const newTextShape: Shape = {
        id: editingText.id,
        type: "text",
        x: editingText.x,
        y: editingText.y,
        text: trimmed,
        fontSize: 22,
        seed: createSeed(),
        ...currentStyles,
      };
      const nextShapes = [...shapes, newTextShape];
      setShapes(nextShapes);
      pushHistory(nextShapes);
      setSelectedId(newTextShape.id);
    }
    setEditingText(null);
  }

  return (
    <div
      className={`excalidraw-container ${isDevMode ? "mode-dev" : "mode-prod"}`}
      ref={containerRef}
    >
      {/* Top Island Toolbar */}
      <Toolbar
        tool={tool}
        setTool={setTool}
        isLocked={isLocked}
        setIsLocked={setIsLocked}
        onClear={handleClearCanvas}
        onExportImage={handleExportImage}
        onExportJson={handleDownloadJson}
        onImportJson={handleImportJson}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        canvasBg={canvasBg}
        setCanvasBg={setCanvasBg}
        isDevMode={isDevMode}
        onToggleDevPreview={() =>
          setPreviewMode((prev) => (prev === "DEV" ? "PROD" : "DEV"))
        }
      />

      {/* Left Properties Panel (when a shape or active styling tool is selected) */}
      <PropertiesPanel
        selectedShape={selectedShape}
        currentStyles={currentStyles}
        onUpdateStyle={handleUpdateStyle}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteSelected}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
      />

      {/* Bottom Left Navigation Controls */}
      <BottomControls
        zoom={zoom}
        onZoomIn={() => setZoom((prev) => Math.min(3, prev * 1.15))}
        onZoomOut={() => setZoom((prev) => Math.max(0.1, prev / 1.15))}
        onResetZoom={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Main Drawing Canvas */}
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{
          cursor:
            tool === "hand" || isSpacePressed
              ? "grab"
              : tool === "select"
              ? "default"
              : tool === "eraser"
              ? "not-allowed"
              : "crosshair",
        }}
      />

      {/* In-line Text Input Overlay */}
      {editingText && (
        <div
          className="text-input-overlay"
          style={{
            left: `${editingText.x * zoom + pan.x}px`,
            top: `${editingText.y * zoom + pan.y}px`,
          }}
        >
          <textarea
            autoFocus
            className="text-editor-input"
            defaultValue={editingText.text}
            placeholder="Type text here..."
            onBlur={(e) => handleSaveText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSaveText((e.target as HTMLTextAreaElement).value);
              }
              if (e.key === "Escape") {
                setEditingText(null);
              }
            }}
          />
        </div>
      )}

      {/* DEV MODE: Bottom Real-Time JSON Tab (Only rendered in DEV mode!) */}
      {isDevMode && (
        <JsonTab
          jsonText={jsonText}
          onChangeJsonText={(text) => {
            setRealTimeSync(false);
            setManualJsonText(text);
          }}
          onApplyJson={handleApplyJsonFromEditor}
          onDownloadJson={handleDownloadJson}
          realTimeSync={realTimeSync}
          onToggleRealTimeSync={() => setRealTimeSync((prev) => !prev)}
          shapesCount={shapes.length}
          statusMessage={statusMessage}
        />
      )}
    </div>
  );
}
