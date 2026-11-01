import type {
  Shape,
  FillStyle,
  StrokeStyle,
} from "../types";
import {
  Copy,
  Trash2,
  BringToFront,
  SendToBack,
} from "lucide-react";

interface PropertiesPanelProps {
  selectedShape: Shape | null;
  currentStyles: {
    strokeColor: string;
    backgroundColor: string;
    fillStyle: FillStyle;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    roughness: number;
    opacity: number;
  };
  onUpdateStyle: (updates: Partial<Shape>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export function PropertiesPanel({
  selectedShape,
  currentStyles,
  onUpdateStyle,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
}: PropertiesPanelProps) {
  // If shape is selected, use its styles; otherwise use global default tool styles
  const strokeColor = selectedShape?.strokeColor ?? currentStyles.strokeColor;
  const backgroundColor = selectedShape?.backgroundColor ?? currentStyles.backgroundColor;
  const fillStyle = (selectedShape?.fillStyle ?? currentStyles.fillStyle) as FillStyle;
  const strokeWidth = selectedShape?.strokeWidth ?? currentStyles.strokeWidth;
  const strokeStyle = (selectedShape?.strokeStyle ?? currentStyles.strokeStyle) as StrokeStyle;
  const roughness = selectedShape?.roughness ?? currentStyles.roughness;
  const opacity = selectedShape?.opacity ?? currentStyles.opacity;

  const strokeColors = [
    { label: "Black", color: "#1e1e1e" },
    { label: "Red", color: "#e03131" },
    { label: "Green", color: "#2f9e44" },
    { label: "Blue", color: "#1971c2" },
    { label: "Orange", color: "#f08c00" },
    { label: "Purple", color: "#6965db" },
    { label: "Pink", color: "#d6336c" },
    { label: "Gray", color: "#868e96" },
  ];

  const backgroundColors = [
    { label: "Transparent", color: "transparent" },
    { label: "Light Red", color: "#ffc9c9" },
    { label: "Light Green", color: "#b2f2bb" },
    { label: "Light Blue", color: "#a5d8ff" },
    { label: "Light Yellow", color: "#ffec99" },
    { label: "Light Purple", color: "#eebefa" },
    { label: "Light Pink", color: "#fcc2d7" },
    { label: "Light Gray", color: "#e9ecef" },
  ];

  return (
    <aside className="properties-panel" aria-label="Shape properties">
      {/* Stroke Color */}
      <div className="prop-group">
        <label className="prop-label">Stroke</label>
        <div className="color-row">
          {strokeColors.map((c) => (
            <button
              key={c.color}
              className={`color-btn ${strokeColor === c.color ? "active" : ""}`}
              style={{ backgroundColor: c.color }}
              onClick={() => onUpdateStyle({ strokeColor: c.color })}
              title={c.label}
            />
          ))}
          <input
            type="color"
            value={strokeColor.startsWith("#") ? strokeColor : "#1e1e1e"}
            onChange={(e) => onUpdateStyle({ strokeColor: e.target.value })}
            className="color-picker-input"
            title="Custom stroke color"
          />
        </div>
      </div>

      {/* Background Color */}
      <div className="prop-group">
        <label className="prop-label">Background</label>
        <div className="color-row">
          {backgroundColors.map((c) => (
            <button
              key={c.color}
              className={`color-btn ${backgroundColor === c.color ? "active" : ""}`}
              style={{
                backgroundColor: c.color === "transparent" ? "#ffffff" : c.color,
                backgroundImage:
                  c.color === "transparent"
                    ? "linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)"
                    : "none",
                backgroundSize: "6px 6px",
              }}
              onClick={() => onUpdateStyle({ backgroundColor: c.color })}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Fill Style */}
      <div className="prop-group">
        <label className="prop-label">Fill</label>
        <div className="btn-toggle-row">
          <button
            className={`toggle-btn ${fillStyle === "hachure" ? "active" : ""}`}
            onClick={() => onUpdateStyle({ fillStyle: "hachure" })}
            title="Hachure lines"
          >
            Hachure
          </button>
          <button
            className={`toggle-btn ${fillStyle === "cross-hatch" ? "active" : ""}`}
            onClick={() => onUpdateStyle({ fillStyle: "cross-hatch" })}
            title="Cross-hatch pattern"
          >
            Cross-hatch
          </button>
          <button
            className={`toggle-btn ${fillStyle === "solid" ? "active" : ""}`}
            onClick={() => onUpdateStyle({ fillStyle: "solid" })}
            title="Solid fill"
          >
            Solid
          </button>
        </div>
      </div>

      {/* Stroke Width */}
      <div className="prop-group">
        <label className="prop-label">Stroke width</label>
        <div className="btn-toggle-row">
          {[
            { label: "Thin", val: 1 },
            { label: "Medium", val: 2 },
            { label: "Bold", val: 4 },
          ].map((item) => (
            <button
              key={item.val}
              className={`toggle-btn ${strokeWidth === item.val ? "active" : ""}`}
              onClick={() => onUpdateStyle({ strokeWidth: item.val })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stroke Style */}
      <div className="prop-group">
        <label className="prop-label">Stroke style</label>
        <div className="btn-toggle-row">
          {[
            { id: "solid", label: "Solid" },
            { id: "dashed", label: "Dashed" },
            { id: "dotted", label: "Dotted" },
          ].map((item) => (
            <button
              key={item.id}
              className={`toggle-btn ${strokeStyle === item.id ? "active" : ""}`}
              onClick={() => onUpdateStyle({ strokeStyle: item.id as StrokeStyle })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Roughness / Sloppiness */}
      <div className="prop-group">
        <label className="prop-label">Sloppiness</label>
        <div className="btn-toggle-row">
          {[
            { label: "Architect", val: 0 },
            { label: "Artist", val: 1 },
            { label: "Cartoonist", val: 2 },
          ].map((item) => (
            <button
              key={item.val}
              className={`toggle-btn ${roughness === item.val ? "active" : ""}`}
              onClick={() => onUpdateStyle({ roughness: item.val })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div className="prop-group">
        <div className="prop-header-with-val">
          <label className="prop-label">Opacity</label>
          <span className="prop-val-text">{opacity}%</span>
        </div>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={opacity}
          onChange={(e) => onUpdateStyle({ opacity: Number(e.target.value) })}
          className="prop-range-slider"
        />
      </div>

      {/* Layering & Actions (only when a shape is selected) */}
      {selectedShape && (
        <>
          <div className="prop-divider" />
          <div className="prop-group">
            <label className="prop-label">Actions</label>
            <div className="actions-grid">
              <button
                className="action-icon-btn"
                onClick={onDuplicate}
                title="Duplicate (Ctrl+D)"
              >
                <Copy size={16} />
                <span>Duplicate</span>
              </button>

              <button
                className="action-icon-btn"
                onClick={onBringToFront}
                title="Bring to Front (])"
              >
                <BringToFront size={16} />
                <span>To front</span>
              </button>

              <button
                className="action-icon-btn"
                onClick={onSendToBack}
                title="Send to Back ([)"
              >
                <SendToBack size={16} />
                <span>To back</span>
              </button>

              <button
                className="action-icon-btn danger"
                onClick={onDelete}
                title="Delete (Delete/Backspace)"
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
