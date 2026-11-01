import { useState } from "react";
import {
  Code2,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface JsonTabProps {
  jsonText: string;
  onChangeJsonText: (text: string) => void;
  onApplyJson: () => void;
  onDownloadJson: () => void;
  realTimeSync: boolean;
  onToggleRealTimeSync: () => void;
  shapesCount: number;
  statusMessage: string;
}

export function JsonTab({
  jsonText,
  onChangeJsonText,
  onApplyJson,
  onDownloadJson,
  realTimeSync,
  onToggleRealTimeSync,
  shapesCount,
  statusMessage,
}: JsonTabProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(jsonText);
      onChangeJsonText(JSON.stringify(parsed, null, 2));
    } catch {
      // Ignore invalid JSON on format attempt
    }
  }

  return (
    <section className={`json-drawer ${isExpanded ? "expanded" : "collapsed"}`}>
      {/* Drawer Header */}
      <div
        className="json-drawer-header"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
      >
        <div className="json-header-left">
          <Code2 size={16} className="json-icon" />
          <span className="json-title">Document JSON</span>
          <span className="dev-tag">DEV MODE</span>

          <span className={`sync-pill ${realTimeSync ? "synced" : "paused"}`}>
            <span className="sync-pulse" />
            {realTimeSync ? "⚡ Live Sync ON" : "Paused"}
          </span>

          <span className="shape-count-badge">
            {shapesCount} {shapesCount === 1 ? "shape" : "shapes"}
          </span>
        </div>

        <div
          className="json-header-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Real-time sync toggle */}
          <button
            type="button"
            className={`btn-sync-toggle ${realTimeSync ? "active" : ""}`}
            onClick={onToggleRealTimeSync}
            title="Toggle real-time JSON updating as shapes are drawn or moved"
          >
            <RefreshCw size={14} className={realTimeSync ? "spin-pulse" : ""} />
            <span>{realTimeSync ? "Real-time: ON" : "Real-time: OFF"}</span>
          </button>

          {/* Download JSON button (prominently available in both states) */}
          <button
            type="button"
            className="btn-json-action btn-download"
            onClick={onDownloadJson}
            title="Download whiteboard.json file"
          >
            <Download size={14} />
            <span>Download JSON</span>
          </button>

          {isExpanded && (
            <>
              <button
                type="button"
                className="btn-json-action"
                onClick={handleCopy}
                title="Copy JSON to clipboard"
              >
                {copied ? <Check size={14} color="#2f9e44" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>

              <button
                type="button"
                className="btn-json-action"
                onClick={handleFormat}
                title="Format JSON"
              >
                <Sparkles size={14} />
                <span>Format</span>
              </button>

              <button
                type="button"
                className="btn-json-action btn-apply"
                onClick={onApplyJson}
                title="Load edited JSON into whiteboard"
              >
                <span>Apply to Whiteboard</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="btn-toggle-expand"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse tab" : "Expand tab"}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Editor Area */}
      {isExpanded && (
        <div className="json-drawer-body">
          <textarea
            className="json-textarea"
            value={jsonText}
            onChange={(e) => onChangeJsonText(e.target.value)}
            placeholder="Live Whiteboard JSON will stream here..."
            spellCheck={false}
          />
          {statusMessage && (
            <div className="json-status-bar" role="status">
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

