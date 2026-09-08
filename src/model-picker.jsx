import React, { useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
export default function ModelPicker({
  models,
  model,
  busy,
  onSelect,
  effort,
  onEffort,
  onOpenChange,
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const toggle = (value) => {
    setOpen(value);
    onOpenChange(value);
  };
  return (
    <div className="model-picker">
      <button
        className="model-trigger"
        disabled={busy}
        onClick={() => toggle(!open)}
      >
        {models.find((m) => m.id === model)?.name || "Choose model"}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="popover model-menu">
          <div className="model-search">
            <Search size={12} />
            <input
              autoFocus
              aria-label="Search models"
              placeholder="Search models…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") toggle(false);
              }}
            />
          </div>
          <div className="model-options">
            {models
              .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
              .map((m) => (
                <button
                  key={m.id}
                  onClick={async () => {
                    await onSelect(m.id);
                    toggle(false);
                  }}
                >
                  <span>{m.name}</span>
                  {model === m.id && <Check size={12} />}
                </button>
              ))}
          </div>
          <div className="reasoning-picker">
            <span>Reasoning</span>
            <div>
              {["low", "medium", "high", "xhigh"].map((level) => (
                <button
                  className={effort === level ? "selected" : ""}
                  key={level}
                  onClick={() => onEffort(level)}
                >
                  {level === "xhigh"
                    ? "Max"
                    : level[0].toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
