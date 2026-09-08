import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const count = (value) =>
  value >= 1000
    ? `${(value / 1000).toFixed(1)}K`
    : Math.round(value).toLocaleString();
export default function ContextUsage({ usage, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const close = useRef(null);
  const known = Number.isFinite(usage?.tokens) && usage.tokens >= 0;
  const limit = usage?.contextWindow;
  const percent =
    known && limit > 0 ? Math.round((usage.tokens / limit) * 100) : null;
  const summary =
    percent == null ? "Context usage unavailable" : `${percent}% context used`;
  const totals = `${known ? count(usage.tokens) : "Unknown"} / ${limit > 0 ? `${Number((limit / 1000).toFixed(1))}K` : "Unknown"}`;
  useEffect(() => {
    onOpenChange(open);
    if (!open) return;
    close.current?.focus();
    const dismiss = (event) => {
      if (event.type === "keydown") {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        trigger.current?.focus();
      } else if (root.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
      onOpenChange(false);
    };
  }, [open, onOpenChange]);
  const rows = usage?.breakdown || [
    {
      id: "system",
      label: "System prompt",
      tokens: null,
    },
    { id: "tools", label: "Tool definitions", tokens: null },
    { id: "rules", label: "Rules", tokens: null },
    { id: "skills", label: "Skills", tokens: null, applicable: false },
    {
      id: "dynamic",
      label: "MCP & dynamic tools",
      tokens: null,
      applicable: false,
    },
    {
      id: "subagents",
      label: "Subagent definitions",
      tokens: null,
      applicable: false,
    },
    { id: "conversation", label: "Conversation", tokens: null },
  ];
  const applicable = rows.filter((row) => row.applicable !== false);
  const segments = applicable.every((row) => row.tokens != null)
    ? applicable
    : [{ id: "conversation", tokens: known ? usage.tokens : 0 }];
  return (
    <div className="context-control" ref={root}>
      <div className="context-anchor">
        <button
          ref={trigger}
          className="context-trigger"
          aria-label={summary}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(!open)}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <circle className="context-ring-track" cx="10" cy="10" r="7" />
            <circle
              className="context-ring-fill"
              cx="10"
              cy="10"
              r="7"
              pathLength="100"
              strokeDasharray={`${Math.min(100, Math.max(0, percent || 0))} 100`}
              transform="rotate(-90 10 10)"
            />
          </svg>
        </button>
        <div className="context-tooltip" role="tooltip">
          <div>{summary}</div>
          <span>{totals} tokens</span>
        </div>
      </div>
      {open && (
        <section
          className="context-popover"
          role="dialog"
          aria-label="Context Usage"
        >
          <header>
            <span>Context Usage</span>
            <button
              ref={close}
              aria-label="Close context usage"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          </header>
          <div className="context-totals">
            <span>
              {percent == null ? "Usage unknown" : `${percent}% Full`}
            </span>
            <span>
              {known ? "~" : ""}
              {totals} Tokens
            </span>
          </div>
          <div className="context-bar" aria-label={summary}>
            {segments.map((row) => (
              <span
                key={row.id}
                className={`context-segment context-category-${row.id}`}
                style={{
                  width: `${limit > 0 ? Math.min(100, (row.tokens / limit) * 100) : 0}%`,
                }}
              />
            ))}
          </div>
          <div className="context-breakdown">
            {rows.map((row) => (
              <div className="context-row" key={row.id}>
                <i className={`context-category-${row.id}`} />
                <span>{row.label}</span>
                <span>
                  {row.applicable === false
                    ? "N/A"
                    : row.tokens == null
                      ? "Not measured"
                      : `~${count(row.tokens)}`}
                </span>
              </div>
            ))}
          </div>
          <p title="Prompt, rules and tools use character estimates. Conversation is the remainder of Pi’s total, including other provider context.">
            Category counts are estimates.
          </p>
        </section>
      )}
    </div>
  );
}
