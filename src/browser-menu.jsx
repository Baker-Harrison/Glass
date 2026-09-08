import React, { useState } from "react";
import { Globe, X, Star } from "lucide-react";
export default function BrowserMenu({
  kind,
  history,
  bookmarks,
  onNavigate,
  onRemove,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const entries = (
    kind === "history"
      ? history.map((url) => ({ url, title: url.replace(/^https?:\/\//, "") }))
      : bookmarks
  ).filter((item) =>
    (item.title + " " + item.url).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="menu-dismiss" onClick={onClose} />
      <div
        className="popover browser-menu"
        role="dialog"
        aria-label={kind === "history" ? "Browsing history" : "Bookmarks"}
      >
        <header>
          <strong>{kind === "history" ? "History" : "Bookmarks"}</strong>
          <button onClick={onClose} aria-label="Close browser menu">
            <X size={13} />
          </button>
        </header>
        <input
          autoFocus
          aria-label="Search browser entries"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <div>
          {entries.length ? (
            entries.map((item) => (
              <div className="browser-menu-row" key={item.url}>
                <button onClick={() => onNavigate(item.url)}>
                  {kind === "history" ? (
                    <Globe size={12} />
                  ) : (
                    <Star size={12} />
                  )}
                  <span>
                    {item.title}
                    <small>{item.url.replace(/^https?:\/\//, "")}</small>
                  </span>
                </button>
                {kind === "bookmarks" && (
                  <button
                    aria-label={"Remove bookmark " + item.title}
                    onClick={() => onRemove(item.url)}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>
              {kind === "history"
                ? "No browsing history."
                : "No bookmarks yet."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
