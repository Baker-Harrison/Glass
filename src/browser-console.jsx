import React, { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
export default function BrowserConsole({ tabId, onClose }) {
  const [kind, setKind] = useState("console"),
    [logs, setLogs] = useState({ console: [], network: [] }),
    [query, setQuery] = useState("");
  useEffect(() => {
    let live = true;
    window.glass.invoke("browser:logs").then((value) => {
      if (live) setLogs(value);
    });
    const dispose = window.glass.subscribe((event) => {
      if (event.tabId !== tabId) return;
      const type =
        event.type === "browser_console"
          ? "console"
          : event.type === "browser_network"
            ? "network"
            : null;
      if (type)
        setLogs((value) => ({
          ...value,
          [type]: [...value[type], event.entry].slice(-200),
        }));
    });
    return () => {
      live = false;
      dispose();
    };
  }, [tabId]);
  const entries = logs[kind].filter((entry) =>
    JSON.stringify(entry).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="browser-console" aria-label="Browser developer console">
      <header>
        <button
          className={kind === "console" ? "active" : ""}
          onClick={() => setKind("console")}
        >
          Console
        </button>
        <button
          className={kind === "network" ? "active" : ""}
          onClick={() => setKind("network")}
        >
          Network
        </button>
        <input
          aria-label="Filter browser logs"
          placeholder="Filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          aria-label="Clear browser logs"
          onClick={async () =>
            setLogs(await window.glass.invoke("browser:logs", { clear: true }))
          }
        >
          <Trash2 size={12} />
        </button>
        <button aria-label="Close browser console" onClick={onClose}>
          <X size={13} />
        </button>
      </header>
      <div role="log" aria-live="polite">
        {entries.map((entry, index) => (
          <div className={"console-entry " + (entry.level || "")} key={index}>
            <time>
              {new Date(entry.time).toLocaleTimeString([], { hour12: false })}
            </time>
            {kind === "console" ? (
              <span>{entry.message}</span>
            ) : (
              <>
                <b className={entry.status >= 400 ? "error" : ""}>
                  {entry.status}
                </b>
                <span>
                  {entry.method} {entry.url}
                </span>
              </>
            )}
          </div>
        ))}
        {!entries.length && (
          <p>
            {query
              ? "No matching entries."
              : kind === "console"
                ? "No console messages."
                : "No network requests recorded."}
          </p>
        )}
      </div>
    </section>
  );
}
