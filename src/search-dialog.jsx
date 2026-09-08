import React, { useEffect, useRef, useState } from "react";
import { Search, MessageSquare, Archive, CornerDownLeft } from "lucide-react";
export function relativeAge(timestamp) {
  if (!timestamp) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}
export default function SearchDialog({
  history,
  onClose,
  onSelect,
  onRestore,
}) {
  const [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false),
    [selected, setSelected] = useState(0);
  const input = useRef(null),
    row = useRef(null);
  const results = history.filter(
    (item) =>
      !!item.archived === archived &&
      `${item.title} ${item.cwd}`.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    setSelected(0);
  }, [query, archived]);
  useEffect(() => {
    row.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <div
      className="search-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="conversation-search"
        role="dialog"
        aria-modal="true"
        aria-label="Search conversations"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelected((i) => Math.min(i + 1, results.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((i) => Math.max(0, i - 1));
          }
          if (e.key === "Enter" && results[selected]) {
            e.preventDefault();
            onSelect(results[selected]);
          }
        }}
      >
        <div className="conversation-search-input">
          <Search size={16} />
          <input
            ref={input}
            aria-label="Find conversation"
            placeholder="Search conversations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose}>Esc</button>
        </div>
        <div className="search-filters">
          <button
            className={!archived ? "selected" : ""}
            onClick={() => setArchived(false)}
          >
            Conversations
          </button>
          <button
            className={archived ? "selected" : ""}
            onClick={() => setArchived(true)}
          >
            <Archive size={12} />
            Archived
          </button>
        </div>
        <div
          className="search-results"
          role="listbox"
          aria-label="Conversations"
        >
          {!results.length && (
            <p className="search-no-results">
              {query
                ? "No conversations found."
                : archived
                  ? "No archived conversations."
                  : "Your conversations will appear here."}
            </p>
          )}
          {results.map((item, index) => (
            <div
              ref={index === selected ? row : null}
              key={item.id}
              className={`search-result ${selected === index ? "selected" : ""}`}
              role="option"
              aria-selected={selected === index}
              onMouseMove={() => setSelected(index)}
            >
              <button onClick={() => onSelect(item)}>
                <MessageSquare size={15} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.cwd?.split("/").pop()}</small>
                </span>
                <time>{relativeAge(item.updatedAt || item.createdAt)}</time>
              </button>
              {archived && (
                <button
                  className="restore-conversation"
                  onClick={() => onRestore(item)}
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
        <footer>
          <span>↑ ↓ Navigate</span>
          <span>
            <CornerDownLeft size={11} /> Open
          </span>
        </footer>
      </section>
    </div>
  );
}
