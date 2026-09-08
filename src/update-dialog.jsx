import React, { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Check, RotateCw, X } from "lucide-react";

// Preview transport: replace with updater events when signed releases are wired.
export default function UpdateDialog({ open, onClose, onReady, onRestart }) {
  const [phase, setPhase] = useState("available");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => previous?.focus?.();
  }, [open]);
  useEffect(() => {
    if (phase !== "downloading") return;
    const start = performance.now();
    const timer = setInterval(() => {
      const percent = Math.min(
        100,
        Math.floor((performance.now() - start) / 60),
      );
      setProgress(percent);
      if (percent === 100) {
        clearInterval(timer);
        setPhase("ready");
        onReady(true);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, onReady]);
  if (!open) return null;
  const ready = phase === "ready" || phase === "restarting";
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        ref={dialog}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            const buttons = [
              ...dialog.current.querySelectorAll("button:not(:disabled)"),
            ];
            const first = buttons[0],
              last = buttons.at(-1);
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              last?.focus();
            } else if (
              !event.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <button
          className="update-close"
          aria-label="Close update"
          onClick={onClose}
        >
          <X size={17} />
        </button>
        <div className="update-symbol">
          {ready ? <Check size={25} /> : <ArrowDownToLine size={25} />}
        </div>
        <h2 id="update-title">
          {ready
            ? "Ready to restart"
            : phase === "downloading"
              ? "Downloading update"
              : "An update is available"}
        </h2>
        <p>
          {ready
            ? "Restart Glass to apply the update."
            : phase === "downloading"
              ? "You can keep working while the update downloads."
              : "Download the latest version of Glass."}
        </p>
        <div className="update-preview-note">
          Preview · No update will be installed
        </div>
        {phase === "downloading" && (
          <div className="update-download">
            <div
              className="update-progress"
              role="progressbar"
              aria-label="Update download"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
        )}
        {error && (
          <p role="alert" className="update-error">
            {error}
          </p>
        )}
        <div className="update-actions">
          <button onClick={onClose}>
            {phase === "downloading" ? "Continue working" : "Later"}
          </button>
          {phase === "available" && (
            <button
              className="update-primary"
              onClick={() => {
                setProgress(0);
                setPhase("downloading");
              }}
            >
              Download update
            </button>
          )}
          {ready && (
            <button
              className="update-primary"
              disabled={phase === "restarting"}
              onClick={async () => {
                setError("");
                setPhase("restarting");
                try {
                  await onRestart();
                } catch (failure) {
                  setError(
                    failure.message || "Could not restart Glass. Try again.",
                  );
                  setPhase("ready");
                }
              }}
            >
              <RotateCw size={14} />
              {phase === "restarting"
                ? "Restarting…"
                : "Restart to apply update"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
