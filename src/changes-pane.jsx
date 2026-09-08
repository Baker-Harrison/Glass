import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
function DiffFile({ file, onOpen }) {
  const [open, setOpen] = useState(true);
  let before = 0,
    after = 0;
  const lines = file.diff?.split("\n").flatMap((text, index) => {
    const hunk = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      before = Number(hunk[1]);
      after = Number(hunk[2]);
      return [{ text, index, type: "range" }];
    }
    if (
      text.startsWith("diff ") ||
      text.startsWith("index ") ||
      text.startsWith("---") ||
      text.startsWith("+++")
    )
      return [];
    if (text.startsWith("+"))
      return [{ text: text.slice(1), index, type: "add", after: after++ }];
    if (text.startsWith("-"))
      return [{ text: text.slice(1), index, type: "remove", before: before++ }];
    if (text.startsWith(" "))
      return [
        {
          text: text.slice(1),
          index,
          type: "context",
          before: before++,
          after: after++,
        },
      ];
    return text ? [{ text, index, type: "meta" }] : [];
  });
  return (
    <section className="diff-file">
      <header>
        <button className="diff-file-toggle" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <FileText size={13} />
          <span>
            {file.path}
            {file.originalPath && <small>from {file.originalPath}</small>}
          </span>
          <i className="diff-added">+{file.additions}</i>
          <i className="diff-deleted">−{file.deletions}</i>
        </button>
        <button
          title="Open file"
          aria-label={"Open " + file.path}
          disabled={file.status.includes("D")}
          onClick={() => onOpen(file)}
        >
          <ExternalLink size={12} />
        </button>
      </header>
      {open &&
        (file.notice ? (
          <p className="diff-notice">{file.notice}</p>
        ) : (
          <div className="diff-lines">
            {lines?.map((line) => (
              <div key={line.index} className={"diff-line " + line.type}>
                <span className="diff-number">{line.before}</span>
                <span className="diff-number">{line.after}</span>
                <code>{line.text || " "}</code>
              </div>
            ))}
            {!lines?.length && (
              <p className="diff-notice">No textual changes.</p>
            )}
          </div>
        ))}
    </section>
  );
}
export default function ChangesPane({ changes, onRefresh, onOpen }) {
  const files = changes?.files || [];
  return (
    <div className="changes-pane">
      <div className="changes-summary">
        <span>
          {files.length} {files.length === 1 ? "file" : "files"} changed
        </span>
        <span className="diff-added">
          +{files.reduce((n, file) => n + (file.additions || 0), 0)}
        </span>
        <span className="diff-deleted">
          −{files.reduce((n, file) => n + (file.deletions || 0), 0)}
        </span>
        <button
          title="Refresh changes"
          aria-label="Refresh changes"
          onClick={onRefresh}
        >
          <RefreshCw size={13} />
        </button>
      </div>
      {changes?.repository ? (
        files.length ? (
          files.map((file) => (
            <DiffFile key={file.path} file={file} onOpen={onOpen} />
          ))
        ) : (
          <div className="panel-empty">No changes to review.</div>
        )
      ) : (
        <div className="panel-empty">This folder is not a Git repository.</div>
      )}
    </div>
  );
}
