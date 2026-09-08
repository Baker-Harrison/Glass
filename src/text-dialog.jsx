import React, { useEffect, useRef, useState } from "react";
export default function TextDialog({
  title,
  initial = "",
  submitLabel = "Save",
  onDone,
}) {
  const [value, setValue] = useState(initial),
    input = useRef(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <div
      className="search-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDone(null);
      }}
    >
      <form
        className="text-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onDone(value.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onDone(null);
          }
        }}
      >
        <h2>{title}</h2>
        <input
          ref={input}
          aria-label={title}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <footer>
          <button type="button" onClick={() => onDone(null)}>
            Cancel
          </button>
          <button className="primary" disabled={!value.trim()}>
            {submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
