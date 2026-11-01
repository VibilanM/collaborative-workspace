import { ZoomIn, ZoomOut, Undo2, Redo2 } from "lucide-react";

interface BottomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function BottomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: BottomControlsProps) {
  const percentage = Math.round(zoom * 100);

  return (
    <div className="bottom-left-island">
      <div className="btn-group">
        <button
          className="control-btn"
          onClick={onZoomOut}
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="control-btn zoom-text-btn"
          onClick={onResetZoom}
          title="Reset zoom to 100%"
          aria-label="Reset zoom"
        >
          {percentage}%
        </button>
        <button
          className="control-btn"
          onClick={onZoomIn}
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
      </div>

      <div className="btn-group">
        <button
          className="control-btn"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          className="control-btn"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 size={16} />
        </button>
      </div>
    </div>
  );
}
