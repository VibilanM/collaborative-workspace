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
  const [canvasBg, setCanvasBg] = useState<string>("#000000");

  // History for Undo / Redo
  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Default drawing properties (Excalidraw deep dark styling)
  const [currentStyles, setCurrentStyles] = useState({
    strokeColor: "#f8fafc",
    backgroundColor: "transparent",
    fillStyle: "hachure" as FillStyle,
    strokeWidth: 2,
    strokeStyle: "solid" as StrokeStyle,
    roughness: 1,
    opacity: 100,
    fontSize: 22,
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
        grid: false,
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
    fontSize: number;
    isNew: boolean;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialMountRef = useRef(false);

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
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

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
      editingShapeId: editingText?.id,
      pan,
      zoom,
      backgroundColor: canvasBg,
    });
  }, [shapes, selectedId, editingText?.id, pan, zoom, canvasBg]);

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

  // Re-render canvas when web fonts finish loading in browser
  useEffect(() => {
    if (document.fonts) {
      document.fonts.ready.then(() => {
        triggerRender();
      });
    }
  }, [triggerRender]);

  // Save in-place text shape
  const handleSaveText = useCallback(
    (textValue: string) => {
      if (!editingText) return;
      const trimmed = textValue.trim();

      if (editingText.isNew) {
        if (trimmed.length > 0) {
          const newTextShape: Shape = {
            id: editingText.id,
            type: "text",
            x: editingText.x,
            y: editingText.y,
            text: trimmed,
            fontSize: editingText.fontSize || currentStyles.fontSize || 22,
            seed: createSeed(),
            ...currentStyles,
          };
          const nextShapes = [...shapes, newTextShape];
          setShapes(nextShapes);
          pushHistory(nextShapes);
          setSelectedId(newTextShape.id);
        }
      } else {
        // Editing existing text shape
        if (trimmed.length > 0) {
          const nextShapes = shapes.map((s) =>
            s.id === editingText.id ? ({ ...s, text: trimmed } as Shape) : s
          );
          setShapes(nextShapes);
          pushHistory(nextShapes);
          setSelectedId(editingText.id);
        } else {
          // If text was cleared completely, delete the shape
          const nextShapes = shapes.filter((s) => s.id !== editingText.id);
          setShapes(nextShapes);
          pushHistory(nextShapes);
          setSelectedId(null);
        }
      }

      setEditingText(null);
      if (!isLocked) {
        setTool("select");
      }
    },
    [editingText, currentStyles, shapes, pushHistory, isLocked]
  );

  // Auto-focus and auto-resize textarea when text editing starts
  useEffect(() => {
    if (editingText) {
      isInitialMountRef.current = true;
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.max(38, textareaRef.current.scrollHeight)}px`;
          textareaRef.current.style.width = "auto";
          textareaRef.current.style.width = `${Math.max(120, textareaRef.current.scrollWidth + 12)}px`;
        }
        setTimeout(() => {
          isInitialMountRef.current = false;
        }, 120);
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [editingText]);

  // Pointer Down (Mouse / Touch)
  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    // If text was being edited and user clicks on canvas, commit it first
    if (editingText) {
      if (textareaRef.current) {
        handleSaveText(textareaRef.current.value);
      }
      return;
    }

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
      const hitShape = [...shapes].reverse().find((s) => isPointInShape(x, y, s, 14));
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
      // 1. Check if clicking on a resize handle of the selected shape (excluding text shapes!)
      if (selectedId) {
        const selectedShape = shapes.find((s) => s.id === selectedId);
        if (selectedShape && selectedShape.type !== "text") {
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

      // 2. Check if clicking on an existing shape (giving priority to currently selected shape)
      let hitShape: Shape | undefined = undefined;
      if (selectedId) {
        const currentSelected = shapes.find((s) => s.id === selectedId);
        if (currentSelected && isPointInShape(x, y, currentSelected, 12)) {
          hitShape = currentSelected;
        }
      }

      if (!hitShape) {
        hitShape = [...shapes].reverse().find((s) => isPointInShape(x, y, s, 10));
      }

      if (hitShape) {
        setSelectedId(hitShape.id);
        isDraggingRef.current = true;
        initialShapeStateRef.current = { ...hitShape };
        dragStartRef.current = { x, y };
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
        fontSize: currentStyles.fontSize || 22,
        isNew: true,
      });
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
      const hitShape = [...shapes].reverse().find((s) => isPointInShape(x, y, s, 14));
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

        case "circle": {
          const w = Math.abs(x - start.x);
          const h = Math.abs(y - start.y);
          const r = Math.max(w, h) / 2;
          const signX = x >= start.x ? 1 : -1;
          const signY = y >= start.y ? 1 : -1;
          draftShapeRef.current = {
            ...draft,
            x: start.x + signX * r,
            y: start.y + signY * r,
            radius: r,
          };
          break;
        }

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
      return;
    }

    // Update cursor hover state when in select mode
    if (tool === "select") {
      const hit = [...shapes].reverse().find((s) => isPointInShape(x, y, s, 10));
      setHoveredShapeId(hit ? hit.id : null);
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
      let draft = draftShapeRef.current;
      draftShapeRef.current = null;

      // If user just clicked without dragging (drag distance <= 4), spawn default shape centered at cursor
      const start = dragStartRef.current;
      const isClick =
        (draft.type === "rectangle" && draft.width <= 4 && draft.height <= 4) ||
        (draft.type === "diamond" && draft.width <= 4 && draft.height <= 4) ||
        (draft.type === "circle" && draft.radius <= 4) ||
        (draft.type === "line" && Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) <= 4) ||
        (draft.type === "arrow" && Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) <= 4);

      if (isClick) {
        if (draft.type === "rectangle") {
          draft = { ...draft, x: start.x - 60, y: start.y - 40, width: 120, height: 80 };
        } else if (draft.type === "diamond") {
          draft = { ...draft, x: start.x - 50, y: start.y - 50, width: 100, height: 100 };
        } else if (draft.type === "circle") {
          draft = { ...draft, x: start.x, y: start.y, radius: 45 };
        } else if (draft.type === "line") {
          draft = { ...draft, x1: start.x - 50, y1: start.y, x2: start.x + 50, y2: start.y };
        } else if (draft.type === "arrow") {
          draft = { ...draft, x1: start.x - 50, y1: start.y, x2: start.x + 50, y2: start.y };
        }
      }

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

  // Double Click on canvas to edit text shape
  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const hitShape = [...shapes].reverse().find((s) => isPointInShape(x, y, s));
    if (hitShape && hitShape.type === "text") {
      setEditingText({
        id: hitShape.id,
        x: hitShape.x,
        y: hitShape.y,
        text: hitShape.text,
        fontSize: hitShape.fontSize || 22,
        isNew: false,
      });
      setSelectedId(null);
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
    handleStartEditText: () => {},
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

      // Enter to edit selected text shape
      if (e.key === "Enter" && actions.selectedId) {
        e.preventDefault();
        actions.handleStartEditText();
        return;
      }

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

  const handleStartEditText = useCallback(() => {
    if (!selectedId) return;
    const target = shapes.find((s) => s.id === selectedId);
    if (target && target.type === "text") {
      setEditingText({
        id: target.id,
        x: target.x,
        y: target.y,
        text: target.text,
        fontSize: target.fontSize || 22,
        isNew: false,
      });
      setSelectedId(null);
    }
  }, [selectedId, shapes]);

  // Update keyboard actions ref on every render
  useEffect(() => {
    keyboardRef.current = {
      handleUndo,
      handleRedo,
      handleDuplicate,
      handleDeleteSelected,
      handleBringToFront,
      handleSendToBack,
      handleStartEditText,
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
    handleStartEditText,
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
        grid: false,
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
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{
          cursor:
            tool === "hand" || isSpacePressed
              ? "grab"
              : tool === "eraser"
              ? "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><circle cx=\"10\" cy=\"10\" r=\"8\" fill=\"rgba(239,68,68,0.2)\" stroke=\"%23ef4444\" stroke-width=\"1.5\"/><line x1=\"6\" y1=\"6\" x2=\"14\" y2=\"14\" stroke=\"%23ef4444\" stroke-width=\"1.5\"/></svg>') 10 10, crosshair"
              : tool === "text"
              ? "text"
              : tool === "select"
              ? hoveredShapeId
                ? "move"
                : "default"
              : "crosshair",
        }}
      />

      {/* In-line Text Input Overlay */}
      {editingText && (
        <div
          className="text-input-overlay"
          style={{
            left: `${editingText.x * zoom + pan.x - 4}px`,
            top: `${editingText.y * zoom + pan.y - 2}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <textarea
            ref={textareaRef}
            className="text-editor-input"
            defaultValue={editingText.text}
            placeholder="Type text here..."
            style={{
              fontSize: `${(editingText.fontSize || 22) * zoom}px`,
              lineHeight: 1.25,
              color: currentStyles.strokeColor || "#f8fafc",
              fontFamily: "'Excalifont', 'Virgil', 'Kalam', 'Patrick Hand', 'Architects Daughter', cursive, sans-serif",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.max(38, el.scrollHeight)}px`;
              el.style.width = "auto";
              el.style.width = `${Math.max(120, el.scrollWidth + 12)}px`;
            }}
            onBlur={(e) => {
              if (isInitialMountRef.current) {
                e.target.focus();
                return;
              }
              handleSaveText(e.target.value);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSaveText((e.target as HTMLTextAreaElement).value);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                const val = (e.target as HTMLTextAreaElement).value.trim();
                if (val.length > 0) {
                  handleSaveText((e.target as HTMLTextAreaElement).value);
                } else {
                  setEditingText(null);
                  if (!isLocked) setTool("select");
                }
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
