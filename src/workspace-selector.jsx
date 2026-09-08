import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Folder,
  FolderOpen,
  GitBranch,
  Search,
} from "lucide-react";

export default function WorkspaceSelector({
  project,
  projects,
  branch,
  onProject,
  onFolder,
  onBranches,
  onBranch,
  onOverlay,
}) {
  const [menu, setMenu] = useState(null);
  const [branches, setBranches] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const root = useRef(null);
  const request = useRef(0);
  const close = () => {
    request.current++;
    setMenu(null);
    setLoading(false);
    setQuery("");
    setError("");
  };
  useEffect(() => {
    onOverlay(!!menu);
    return () => onOverlay(false);
  }, [menu]);
  useEffect(() => {
    close();
  }, [project]);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event) => {
      if (!root.current?.contains(event.target)) close();
    };
    const key = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", key);
    };
  }, [menu]);
  const toggle = async (kind) => {
    if (menu === kind) return close();
    const current = ++request.current;
    setMenu(kind);
    setLoading(false);
    setQuery("");
    setError("");
    if (kind !== "branches") return;
    setBranches([]);
    setLoading(true);
    try {
      const result = await onBranches();
      if (current === request.current) setBranches(result.branches);
    } catch (error) {
      if (current === request.current) setError(error.message);
    } finally {
      if (current === request.current) setLoading(false);
    }
  };
  const select = async (action) => {
    setLoading(true);
    setError("");
    try {
      await action();
      close();
    } catch (error) {
      setError(
        error.message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          "",
        ),
      );
    } finally {
      setLoading(false);
    }
  };
  const paths = [...new Set([project, ...projects].filter(Boolean))];
  return (
    <div className="workspace-selector" ref={root}>
      <button
        aria-label="Select project"
        aria-expanded={menu === "projects"}
        onClick={() => toggle("projects")}
      >
        {project.split("/").pop() || "Open project"}
        <ChevronDown size={11} />
      </button>
      {branch && (
        <button
          aria-label="Switch Git branch"
          aria-expanded={menu === "branches"}
          onClick={() => toggle("branches")}
        >
          <GitBranch size={12} />
          <span>{branch}</span>
        </button>
      )}
      {menu && (
        <div
          className="workspace-selector-menu"
          role="dialog"
          aria-label={menu === "projects" ? "Recent projects" : "Git branches"}
        >
          <label className="selector-search">
            <Search size={13} />
            <input
              autoFocus
              aria-label={
                menu === "projects" ? "Filter projects" : "Filter branches"
              }
              placeholder={
                menu === "projects" ? "Search projects…" : "Search branches…"
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="selector-list">
            {menu === "projects"
              ? paths
                  .filter((path) =>
                    path.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((path) => (
                    <button
                      key={path}
                      disabled={loading}
                      onClick={() => select(() => onProject(path))}
                    >
                      <Folder size={14} />
                      <span className="selector-project-label">
                        <strong>{path.split("/").pop()}</strong>
                        <small title={path}>{path}</small>
                      </span>
                      {path === project && <Check size={13} />}
                    </button>
                  ))
              : branches
                  .filter((name) =>
                    name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((name) => (
                    <button
                      key={name}
                      disabled={loading || name === branch}
                      onClick={() => select(() => onBranch(name))}
                    >
                      <GitBranch size={13} />
                      <span>{name}</span>
                      {name === branch && <Check size={13} />}
                    </button>
                  ))}
            {loading && <p>Loading…</p>}
            {!loading &&
              menu === "branches" &&
              !branches.some((name) =>
                name.toLowerCase().includes(query.toLowerCase()),
              ) && <p>No matching branches</p>}
            {!loading &&
              menu === "projects" &&
              !paths.some((path) =>
                path.toLowerCase().includes(query.toLowerCase()),
              ) && <p>No matching projects</p>}
          </div>
          {error && (
            <p className="selector-error" role="alert">
              {error}
            </p>
          )}
          {menu === "projects" && (
            <button
              className="selector-folder"
              disabled={loading}
              onClick={() => select(onFolder)}
            >
              <FolderOpen size={14} />
              Select folder…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
