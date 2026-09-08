import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/editor/editor.api";
import EditorWorker from "monaco-editor/editor/editor.worker?worker&inline";
import "monaco-editor/editor/contrib/find/browser/findController.js";
import "monaco-editor/editor/contrib/folding/browser/folding.js";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/css/register.js";
import "monaco-editor/languages/definitions/html/register.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/swift/register.js";
import "monaco-editor/languages/definitions/shell/register.js";
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
monaco.editor.defineTheme("glass-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#FAF9F7",
    "editorLineNumber.foreground": "#B8B0A5",
    "editor.lineHighlightBackground": "#F3F0EC",
    "editor.selectionBackground": "#DCE6F2",
    "editorGutter.background": "#FAF9F7",
  },
});
const viewStates = new Map();
const languages = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  css: "css",
  html: "html",
  md: "markdown",
  py: "python",
  swift: "swift",
  sh: "shell",
  json: "json",
};
export default function CodeEditor({
  path,
  value,
  onChange,
  onSave,
  onSelection,
  location,
}) {
  const host = useRef(null),
    instance = useRef(null),
    localEdits = useRef(new Set()),
    latest = useRef({ onChange, onSave, onSelection });
  latest.current = { onChange, onSave, onSelection };
  useEffect(() => {
    const uri = monaco.Uri.parse("file://" + path);
    const model =
      monaco.editor.getModel(uri) ||
      monaco.editor.createModel(
        value,
        languages[path.split(".").pop()] || "plaintext",
        uri,
      );
    if (model.getValue() !== value) model.setValue(value);
    const editor = monaco.editor.create(host.current, {
      model,
      theme: "glass-light",
      automaticLayout: true,
      fontSize: 12,
      fontFamily: "Menlo, monospace",
      lineHeight: 20,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: 14 },
      renderLineHighlight: "line",
      smoothScrolling: true,
      tabSize: 2,
      wordWrap: "off",
      ariaLabel: "Edit " + path,
    });
    instance.current = editor;
    const savedView = viewStates.get(path);
    if (savedView) editor.restoreViewState(savedView);
    const change = editor.onDidChangeModelContent(() => {
      const next = editor.getValue();
      localEdits.current.add(next);
      if (localEdits.current.size > 100)
        localEdits.current.delete(localEdits.current.values().next().value);
      latest.current.onChange(next);
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      latest.current.onSave(editor.getValue()),
    );
    editor.addAction({
      id: "glass.add-selection",
      label: "Add selection to chat",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
      contextMenuGroupId: "navigation",
      run: () => {
        const selection = editor.getSelection();
        latest.current.onSelection?.({
          path,
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber,
          text: editor.getModel().getValueInRange(selection),
        });
      },
    });
    return () => {
      viewStates.set(path, editor.saveViewState());
      localEdits.current.clear();
      change.dispose();
      editor.dispose();
      instance.current = null;
    };
  }, [path]);
  useEffect(() => {
    if (localEdits.current.has(value)) {
      localEdits.current.delete(value);
      return;
    }
    if (instance.current && instance.current.getValue() !== value)
      instance.current.setValue(value);
  }, [value]);
  useEffect(() => {
    const editor = instance.current;
    if (!editor || !location?.line) return;
    const line = Math.max(
      1,
      Math.min(editor.getModel().getLineCount(), location.line),
    );
    editor.setPosition({ lineNumber: line, column: location.column || 1 });
    editor.revealLineInCenter(line);
    editor.focus();
  }, [path, location]);
  return <div className="code-editor" ref={host} />;
}
