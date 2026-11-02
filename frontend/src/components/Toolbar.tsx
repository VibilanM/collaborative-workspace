import { useState, useRef, useEffect } from "react";
import type { Tool } from "../types";
import {
  Lock,
  Unlock,
  Hand,
  MousePointer,
  Square,
  Diamond,
  Circle,
  MoveUpRight,
  Minus,
  Pencil,
  Type,
  Eraser,
  Menu,
  Download,
  Upload,
  Image,
  Trash2,
} from "lucide-react";

interface ToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  onClear: () => void;
  onExportImage: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  isDevMode: boolean;
  onToggleDevPreview?: () => void;
}

export function Toolbar({
  tool,
  setTool,
  isLocked,
  setIsLocked,
  onClear,
  onExportImage,
  onExportJson,
  onImportJson,
  isDevMode,
  onToggleDevPreview,
}: ToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      window.addEventListener("pointerdown", handleClickOutside);
    }
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [menuOpen]);

  const tools: { id: Tool; label: string; icon: typeof Square; shortcut: string }[] = [
    { id: "hand", label: "Hand (panning tool)", icon: Hand, shortcut: "H" },
    { id: "select", label: "Selection", icon: MousePointer, shortcut: "1" },
    { id: "rectangle", label: "Rectangle", icon: Square, shortcut: "2" },
    { id: "diamond", label: "Diamond", icon: Diamond, shortcut: "3" },
    { id: "circle", label: "Ellipse", icon: Circle, shortcut: "4" },
    { id: "arrow", label: "Arrow", icon: MoveUpRight, shortcut: "5" },
    { id: "line", label: "Line", icon: Minus, shortcut: "6" },
    { id: "draw", label: "Draw", icon: Pencil, shortcut: "7" },
    { id: "text", label: "Text", icon: Type, shortcut: "8" },
    { id: "eraser", label: "Eraser", icon: Eraser, shortcut: "0" },
  ];

  return (
    <>
      {/* Top Left Menu Button & Dropdown */}
      <div className="top-left-panel" ref={menuRef}>
        <button
          className={`menu-btn ${menuOpen ? "active" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          title="Whiteboard menu"
          aria-label="Whiteboard menu"
        >
          <Menu size={20} />
        </button>

        {menuOpen && (
          <div className="dropdown-menu">
            <div className="dropdown-section">
              <label className="dropdown-item">
                <Upload size={16} />
                <span>Open JSON file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportJson(file);
                      setMenuOpen(false);
                    }
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                className="dropdown-item"
                onClick={() => {
                  onExportJson();
                  setMenuOpen(false);
                }}
              >
                <Download size={16} />
                <span>Download whiteboard (.json)</span>
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  onExportImage();
                  setMenuOpen(false);
                }}
              >
                <Image size={16} />
                <span>Export as PNG image</span>
              </button>
            </div>

            <div className="dropdown-divider" />

            <div className="dropdown-section">
              <button
                className="dropdown-item danger"
                onClick={() => {
                  if (confirm("Are you sure you want to clear the entire whiteboard?")) {
                    onClear();
                    setMenuOpen(false);
                  }
                }}
              >
                <Trash2 size={16} />
                <span>Clear canvas</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Center Toolbar */}
      <nav className="toolbar-island" aria-label="Tool selection">
        <button
          className={`tool-btn lock-btn ${isLocked ? "active" : ""}`}
          onClick={() => setIsLocked(!isLocked)}
          title={`Keep tool selected (${isLocked ? "locked" : "unlocked"})`}
        >
          {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        <div className="toolbar-divider" />

        {tools.map((item) => {
          const Icon = item.icon;
          const isActive = tool === item.id;
          return (
            <button
              key={item.id}
              className={`tool-btn ${isActive ? "active" : ""}`}
              onClick={() => setTool(item.id)}
              title={`${item.label} — ${item.shortcut}`}
            >
              <Icon size={18} />
              <span className="key-hint">{item.shortcut}</span>
            </button>
          );
        })}
      </nav>

      {/* Top Right Mode Pill */}
      <div className="top-right-panel">
        <div className={`mode-badge ${isDevMode ? "dev-badge" : "prod-badge"}`}>
          <span className="mode-dot" />
          <span className="mode-text">
            {isDevMode ? "DEV MODE" : "PROD MODE"}
          </span>
          {onToggleDevPreview && (
            <button
              className="mode-toggle-link"
              onClick={onToggleDevPreview}
              title="Click to toggle DEV / PROD view"
            >
              (switch)
            </button>
          )}
        </div>
      </div>
    </>
  );
}

