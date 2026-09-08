import glassLogo from "../assets/glass.png";
import { profile, features } from "./app-config.js";
import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus,
  Search,
  PanelLeft,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  Square,
  Globe,
  Terminal,
  Files,
  X,
  Settings,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  MousePointer2,
  Check,
  FileText,
  FilePlus,
  FolderPlus,
  Star,
  History,
  MessageSquare,
  Maximize2,
  Minimize2,
  GitBranch,
  Pin,
  Archive,
  MoreHorizontal,
  BookOpen,
  Keyboard,
  LogOut,
} from "lucide-react";
import "./style.css";
import SearchDialog, { relativeAge } from "./search-dialog.jsx";
import ChangesPane from "./changes-pane.jsx";
import SplitChat from "./split-chat.jsx";
import BrowserConsole from "./browser-console.jsx";
import BrowserMenu from "./browser-menu.jsx";
import { browserAddress } from "./browser-input.mjs";
import TextDialog from "./text-dialog.jsx";
import PlanPane from "./plan-pane.jsx";
import Question from "./question.jsx";
import ModelPicker from "./model-picker.jsx";
import Conversation from "./conversation.jsx";
import { applyMessageEvent } from "./conversation-model.mjs";
class PanelBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="panel-empty" role="alert">
          <p>This panel could not load.</p>
          <button onClick={() => location.reload()}>Reload Glass</button>
        </div>
      );
    return this.props.children;
  }
}
const CodeEditor = lazy(() => import("./code-editor.jsx"));
const TerminalPane = lazy(() => import("./terminal.jsx"));
const api = (channel, args) =>
  window.glass
    ? window.glass.invoke(channel, args)
    : Promise.reject(
        new Error("Open Glass as a desktop app to use this feature."),
      );
const textOf = (message) =>
  typeof message.content === "string"
    ? message.content
    : (message.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
function IconButton({ title, children, onClick, active, disabled }) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function readSaved(key, fallback) {
  try {
    return (
      JSON.parse(localStorage.getItem("glass." + key + ".v1") || "null") ??
      fallback
    );
  } catch {
    return fallback;
  }
}
function writeSaved(key, value) {
  localStorage.setItem("glass." + key + ".v1", JSON.stringify(value));
}
function App() {
  const uiCommands = useRef({});
  const [textDialog, setTextDialog] = useState(null);
  const [accountMenu, setAccountMenu] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectMenu, setProjectMenu] = useState(null);
  const [fileMenu, setFileMenu] = useState(null);
  const [terminalMenu, setTerminalMenu] = useState(false);
  const [browserConsole, setBrowserConsole] = useState(false);
  const [split, setSplit] = useState(() => readSaved("split", null));
  const [splitOverlay, setSplitOverlay] = useState(false);
  const [fileContexts, setFileContexts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [browserMenu, setBrowserMenu] = useState(null),
    [browserSnapshot, setBrowserSnapshot] = useState(null),
    [bookmarks, setBookmarks] = useState(() => readSaved("bookmarks", []));
  useEffect(() => writeSaved("bookmarks", bookmarks), [bookmarks]);
  const requestText = (title, initial = "") =>
    new Promise((resolve) =>
      setTextDialog({
        title,
        initial,
        onDone: (value) => {
          setTextDialog(null);
          resolve(value);
        },
      }),
    );
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [appsVisible, setAppsVisible] = useState(true);
  const lastPanel = useRef("browser");
  const setPanel = (next) => {
    setPanelExpanded(false);
    if (next) lastPanel.current = next;
    else setAppsVisible(true);
    setPanelState(next);
  };
  const [plan, setPlan] = useState(null),
    [planDismissed, setPlanDismissed] = useState(false);
  const submitting = useRef(false);
  const [queued, setQueued] = useState([]);
  const fileBuffers = useRef(new Map());
  const fileState = useRef(null);
  const restoredEditor = useRef(false);
  const [editorReady, setEditorReady] = useState(false);
  const [terminalTabs, setTerminalTabs] = useState([]),
    [terminalActive, setTerminalActive] = useState(null);
  const terminalOpening = useRef(false);
  const [fileRevision, setFileRevision] = useState(0);
  const [openFiles, setOpenFiles] = useState([]);
  const [editorLocation, setEditorLocation] = useState(null);
  const fileRequest = useRef(0);
  const [project, setProject] = useState(""),
    [history, setHistory] = useState([]),
    [models, setModels] = useState([]),
    [model, setModel] = useState(""),
    [active, setActive] = useState(() => readSaved("active", null)),
    [messages, setMessages] = useState([]),
    [draft, setDraft] = useState(
      () => readSaved("drafts", {})[readSaved("active", null) || "new"] || "",
    ),
    [mode, setMode] = useState("agent"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [panel, setPanelState] = useState(() => readSaved("panel", "browser")),
    [sidebar, setSidebar] = useState(() => readSaved("sidebar", true)),
    [settings, setSettings] = useState(false),
    [question, setQuestion] = useState(null),
    [auth, setAuth] = useState(null),
    [filter, setFilter] = useState("");
  const navigation = useRef([active]),
    navigationIndexRef = useRef(0),
    navigating = useRef(false);
  const [navigationIndex, setNavigationIndex] = useState(0);
  useEffect(() => {
    if (navigating.current) {
      navigating.current = false;
      return;
    }
    if (navigation.current[navigationIndexRef.current] === active) return;
    navigation.current = [
      ...navigation.current.slice(0, navigationIndexRef.current + 1),
      active,
    ];
    navigationIndexRef.current = navigation.current.length - 1;
    setNavigationIndex(navigationIndexRef.current);
  }, [active]);
  const navigateChat = (offset) => {
    const next = navigationIndexRef.current + offset;
    if (next < 0 || next >= navigation.current.length) return;
    const id = navigation.current[next];
    const item = history.find((item) => item.id === id);
    if (id && !item) return;
    navigating.current = true;
    navigationIndexRef.current = next;
    setNavigationIndex(next);
    if (id) openConversation(item);
    else newChat();
  };
  const [entries, setEntries] = useState({}),
    [expanded, setExpanded] = useState(new Set(["."])),
    [file, setFile] = useState(null),
    [content, setContent] = useState(""),
    [original, setOriginal] = useState(""),
    [url, setUrl] = useState("");
  const [modelMenu, setModelMenu] = useState(false),
    [effort, setEffort] = useState("medium");
  const [browserHistory, setBrowserHistory] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("glass.browserHistory.v1") || "[]",
      );
    } catch {
      return [];
    }
  });
  const [projects, setProjects] = useState([]),
    [collapsedProjects, setCollapsedProjects] = useState(new Set()),
    [chatMenu, setChatMenu] = useState(false);
  const [panelTabs, setPanelTabs] = useState(() =>
      readSaved("panelTabs", ["browser"]),
    ),
    [tabMenu, setTabMenu] = useState(false),
    [panelWidth, setPanelWidth] = useState(() => readSaved("panelWidth", 51)),
    [sideWidth, setSideWidth] = useState(() => readSaved("sideWidth", 232)),
    [contextMenu, setContextMenu] = useState(false);
  const [git, setGit] = useState({}),
    [changeList, setChangeList] = useState(null),
    [fileQuery, setFileQuery] = useState(""),
    [matches, setMatches] = useState([]);
  const [browserTabs, setBrowserTabs] = useState([]),
    [browserActive, setBrowserActive] = useState(null),
    [selection, setSelection] = useState(null);
  const shouldFollow = useRef(true),
    conversationScroll = useRef(null);
  const conversationRequest = useRef(0);
  const activeRef = useRef(active),
    bottom = useRef(null),
    browserBox = useRef(null),
    composer = useRef(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const run = async (fn) => {
    try {
      setError("");
      return await fn();
    } catch (e) {
      setError(
        e.message.replace(/^Error invoking remote method '[^']+': Error: /, ""),
      );
    }
  };
  const refresh = async () => {
    const state = await api("state");
    setProject(state.project);
    setProjects(state.projects || [state.project]);
    setGit(state.git || {});
    setHistory(state.conversations);
    setModels(state.models);
    setTerminalTabs(state.terminals || []);
    if (!restoredEditor.current) {
      restoredEditor.current = true;
      const savedEditor = state.editor || { files: [], buffers: [] };
      fileBuffers.current = new Map(savedEditor.buffers || []);
      setOpenFiles(savedEditor.files || []);
      const entry = savedEditor.files?.find(
        (item) =>
          item.key === savedEditor.activeFile && item.cwd === state.project,
      );
      if (entry) {
        const cached = fileBuffers.current.get(entry.key);
        try {
          const value =
            cached?.content ??
            (await api("files:read", { relative: entry.path }));
          setFile(entry);
          setContent(value);
          setOriginal(cached?.original ?? value);
        } catch {
          setOpenFiles((items) =>
            items.filter((item) => item.key !== entry.key),
          );
        }
      }
      setEditorReady(true);
    }
    if (state.browser) {
      setBrowserTabs(state.browser.tabs);
      setBrowserActive(state.browser.active);
      setUrl(
        state.browser.tabs.find((tab) => tab.id === state.browser.active)
          ?.url || "",
      );
    }
    setModel((current) => current || state.models[0]?.id || "");
  };
  useEffect(() => {
    if (window.glass)
      run(async () => {
        await refresh();
        const id = readSaved("active", null);
        if (id) {
          const result = await api("agent:create", { id });
          setActive(result.id);
          activeRef.current = result.id;
          setMessages(result.messages);
          setMode(result.mode);
          setModel(result.modelId || "");
          setEffort(result.thinkingLevel || "medium");
          setBusy(result.busy ?? false);
          setQuestion(result.question ?? null);
          setPlan(result.plan ?? null);
          if (panel === "plan" && !result.plan) setPanel(null);
          setPlanDismissed(false);
          setQueued(result.queued ?? []);
        }
      });
  }, []);
  useEffect(
    () =>
      window.glass?.subscribe((event) => {
        if (event.type === "context_usage") {
          setHistory((items) =>
            items.map((item) =>
              item.id === event.sessionId
                ? { ...item, contextUsage: event.usage }
                : item,
            ),
          );
        }
        if (
          event.type === "session_settings" &&
          event.sessionId === activeRef.current
        ) {
          if (event.mode) setMode(event.mode);
          if (event.modelId) setModel(event.modelId);
          if (event.thinkingLevel) setEffort(event.thinkingLevel);
        }
        if (event.type === "terminal_sessions") setTerminalTabs(event.sessions);
        if (event.type === "ui_command") uiCommands.current[event.action]?.();
        if (event.type === "plan" && event.sessionId === activeRef.current) {
          setPlan(event.plan);
          if (event.created) {
            setPlanDismissed(false);
            setPanel("plan");
          }
        }
        if (event.type === "auth") setAuth(event.event);
        if (event.type === "auth_complete") {
          if (activeRef.current)
            run(async () => {
              await api("agent:create", { id: activeRef.current });
              await refresh();
            });
          setModels(event.models);
          setModel(event.models[0]?.id ?? "");
          setAuth(null);
          setQuestion(null);
          setSettings(false);
        }
        if (
          event.type === "question" &&
          (event.sessionId === activeRef.current || event.sessionId === "auth")
        )
          setQuestion(event);
        if (["question_cancelled", "question_answered"].includes(event.type))
          setQuestion((q) => (q?.id === event.id ? null : q));
        if (
          event.type === "error" &&
          (!event.sessionId || event.sessionId === activeRef.current)
        ) {
          setError(event.message);
          setBusy(false);
        }
        if (event.type === "browser_tabs") {
          setBrowserTabs(event.tabs);
          setBrowserActive(event.active);
          const tab = event.tabs.find((t) => t.id === event.active);
          setUrl(tab?.url || "");
        }
        if (event.type === "browser_selection") {
          if (event.selection.prompt)
            uiCommands.current.designPrompt?.(event.selection);
          else setSelection(event.selection);
          composer.current?.focus();
        }
        if (event.type === "browser_url") {
          setUrl(event.url);
          if (/^https?:/.test(event.url))
            setBrowserHistory((items) => {
              const next = [
                event.url,
                ...items.filter((url) => url !== event.url),
              ].slice(0, 30);
              localStorage.setItem(
                "glass.browserHistory.v1",
                JSON.stringify(next),
              );
              return next;
            });
        }
        if (event.type === "browser_snapshot")
          setBrowserSnapshot(event.dataURL);
        if (event.type === "browser_error") setError(event.message);
        if (event.type === "question")
          setHistory((items) =>
            items.map((item) =>
              item.id === event.sessionId ? { ...item, waiting: true } : item,
            ),
          );
        if (["question_cancelled", "question_answered"].includes(event.type))
          setHistory((items) =>
            items.map((item) =>
              item.id === event.sessionId ? { ...item, waiting: false } : item,
            ),
          );
        if (
          event.type === "agent_event" &&
          ["agent_start", "agent_end"].includes(event.event.type)
        ) {
          const running = event.event.type === "agent_start";
          setHistory((items) =>
            items.map((item) =>
              item.id === event.sessionId
                ? {
                    ...item,
                    busy: running,
                    waiting: false,
                    ...(!running ? { completedAt: Date.now() } : {}),
                    ...(event.sessionId === activeRef.current
                      ? { readAt: Date.now() }
                      : {}),
                  }
                : item,
            ),
          );
          if (!running && event.sessionId === activeRef.current)
            void api("conversation:update", {
              id: event.sessionId,
              read: true,
            });
        }
        if (
          event.type !== "agent_event" ||
          event.sessionId !== activeRef.current
        )
          return;
        const e = event.event;
        if (
          e.type === "tool_execution_end" &&
          ["write", "edit"].includes(e.toolName) &&
          !e.isError
        )
          setFileRevision((value) => value + 1);
        if (e.type === "queue_update")
          setQueued([...e.steering, ...e.followUp]);
        if (
          e.type === "message_end" &&
          e.message.role === "assistant" &&
          e.message.errorMessage &&
          e.message.stopReason !== "aborted"
        )
          setError(e.message.errorMessage);
        if (e.type === "agent_start") setBusy(true);
        if (e.type === "agent_end") {
          setBusy(false);
          run(refresh);
        }
        if (["message_start", "message_update", "message_end"].includes(e.type))
          setMessages((prev) => applyMessageEvent(prev, e));
      }),
    [],
  );
  useEffect(() => {
    if (shouldFollow.current)
      bottom.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, question]);
  useEffect(() => {
    const listener = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        newChat();
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "b") {
        e.preventDefault();
        setSidebar((v) => !v);
      }
      if (
        e.key === "Tab" &&
        e.shiftKey &&
        e.target === composer.current &&
        !busy
      ) {
        e.preventDefault();
        const next = mode === "plan" ? "agent" : "plan";
        run(async () => {
          if (active) await api("agent:mode", { id: active, mode: next });
          setMode(next);
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setPanel("terminal");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault();
        setPanel("files");
        loadFiles();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "b"
      ) {
        e.preventDefault();
        setPanel("browser");
      }
      if (e.key === "Escape") {
        setSettings(false);
        setAccountMenu(false);
        setShortcutsOpen(false);
        setContextMenu(false);
        setTabMenu(false);
        setModelMenu(false);
        setBrowserMenu(null);
        setImagePreview(null);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active, mode]);
  useEffect(() => {
    if (
      panel !== "browser" ||
      accountMenu ||
      shortcutsOpen ||
      searchOpen ||
      projectMenu ||
      splitOverlay ||
      imagePreview ||
      browserMenu ||
      textDialog ||
      settings ||
      question ||
      tabMenu ||
      contextMenu ||
      chatMenu ||
      modelMenu
    ) {
      if (window.glass) api("browser:bounds", { visible: false });
      return;
    }
    const update = () => {
      const rect = browserBox.current?.getBoundingClientRect();
      if (rect)
        api("browser:bounds", {
          visible: true,
          bounds: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        });
    };
    const observer = new ResizeObserver(update);
    if (browserBox.current) observer.observe(browserBox.current);
    update();
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [
    accountMenu,
    shortcutsOpen,
    panel,
    sidebar,
    searchOpen,
    browserMenu,
    imagePreview,
    splitOverlay,
    projectMenu,
    textDialog,
    settings,
    question,
    tabMenu,
    contextMenu,
    chatMenu,
    modelMenu,
    panelWidth,
    panelExpanded,
    sideWidth,
  ]);
  useEffect(() => {
    if (panel)
      setPanelTabs((tabs) => (tabs.includes(panel) ? tabs : [...tabs, panel]));
  }, [panel]);
  useEffect(() => {
    if (panel === "files" && project) loadFiles();
  }, [panel, project]);
  async function newTerminal() {
    if (terminalOpening.current) return;
    terminalOpening.current = true;
    try {
      const result = await api("terminal:open");
      setTerminalActive(result.id);
      setPanel("terminal");
    } catch (error) {
      setError(error.message);
    } finally {
      terminalOpening.current = false;
    }
  }
  useEffect(() => {
    if (panel !== "terminal" || !project) return;
    if (
      terminalTabs.some(
        (tab) => tab.id === terminalActive && tab.cwd === project,
      )
    )
      return;
    const existing = terminalTabs.find((tab) => tab.cwd === project);
    if (existing) setTerminalActive(existing.id);
    else void newTerminal();
  }, [panel, project, terminalTabs, terminalActive]);
  const resizePanel = (e) => {
    e.preventDefault();
    const start = e.clientX,
      initial = panelWidth;
    const move = (event) =>
      setPanelWidth(
        Math.min(
          70,
          Math.max(
            25,
            initial + ((start - event.clientX) / window.innerWidth) * 100,
          ),
        ),
      );
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  const resizeSidebar = (e) => {
    e.preventDefault();
    const move = (event) =>
      setSideWidth(Math.min(380, Math.max(165, event.clientX)));
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  useEffect(() => {
    writeSaved("active", active);
  }, [active]);
  useEffect(() => {
    const drafts = readSaved("drafts", {});
    drafts[active || "new"] = draft;
    writeSaved("drafts", drafts);
  }, [draft, active]);
  useEffect(() => {
    for (const [key, value] of Object.entries({
      panel,
      panelTabs,
      panelWidth,
      sideWidth,
      sidebar,
      split,
    }))
      writeSaved(key, value);
  }, [panel, panelTabs, panelWidth, sideWidth, sidebar, split]);
  const newChat = () => {
    conversationRequest.current++;
    setSelection(null);
    if (panel === "plan") setPanel(null);
    setEditing(null);
    setFileContexts([]);
    setActive(null);
    activeRef.current = null;
    setMessages([]);
    setDraft(readSaved("drafts", {}).new || "");
    setBusy(false);
    setQuestion(null);
    setPlan(null);
    setPlanDismissed(false);
    setQueued([]);
    composer.current?.focus();
  };
  async function submit(override) {
    const message = typeof override?.text === "string" ? override.text : draft;
    const attachment =
      typeof override?.text === "string" ? override.selection : selection;
    if (!message.trim() || submitting.current) return;
    submitting.current = true;
    setModelMenu(false);
    setContextMenu(false);
    shouldFollow.current = true;
    const text =
      message +
      (attachment
        ? "\n\nSelected browser element:\n" +
          JSON.stringify(
            { ...attachment, image: undefined, prompt: undefined },
            null,
            2,
          )
        : "") +
      (!override?.text && fileContexts.length
        ? "\n\nFile context:\n" + JSON.stringify(fileContexts)
        : "");
    try {
      const submitted = await run(async () => {
        let id = active;
        if (editing && !override?.text) {
          const fork = await api("agent:fork", {
            id,
            timestamp: editing.timestamp,
            before: true,
          });
          const savedDrafts = readSaved("drafts", {});
          savedDrafts[id] = editing.previousDraft;
          writeSaved("drafts", savedDrafts);
          id = fork.id;
          setActive(id);
          activeRef.current = id;
          setMessages(fork.messages);
          setEditing(null);
          await api("agent:model", { id, thinkingLevel: effort });
        }
        if (!id) {
          const session = await api("agent:create", { mode, modelId: model });
          id = session.id;
          setActive(id);
          activeRef.current = id;
        }
        if (!active) {
          await api("agent:model", { id, thinkingLevel: effort });
          const drafts = readSaved("drafts", {});
          drafts.new = "";
          writeSaved("drafts", drafts);
        }
        await api("agent:prompt", {
          id,
          text,
          images: attachment?.image ? [attachment.image] : [],
        });
        if (!override?.text) {
          setDraft("");
          setSelection(null);
          setFileContexts([]);
        }
        setBusy(true);
        await refresh();
        return true;
      });
      if (!submitted && override?.text) {
        setDraft((previous) =>
          previous ? previous + "\n\n" + message : message,
        );
        setSelection(attachment);
      }
    } finally {
      submitting.current = false;
    }
  }
  async function openConversation(item) {
    const request = ++conversationRequest.current;
    shouldFollow.current = true;
    await run(async () => {
      if (item.cwd !== project) {
        const selected = await api("project:select", { cwd: item.cwd });
        setProject(selected.project);
        setProjects((items) =>
          items.includes(selected.project)
            ? items
            : [...items, selected.project],
        );
        setGit(selected.git);
        setEntries({});
        setFile(null);
      }
      const result = await api("agent:create", { id: item.id });
      if (request !== conversationRequest.current) return;
      setEditing(null);
      setSelection(null);
      setFileContexts([]);
      await api("conversation:update", { id: item.id, read: true });
      if (request !== conversationRequest.current) return;
      setHistory((items) =>
        items.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: Date.now() } : entry,
        ),
      );
      setActive(result.id);
      activeRef.current = result.id;
      setDraft(readSaved("drafts", {})[result.id] || "");
      setMessages(result.messages);
      setModel(result.modelId || model);
      setEffort(result.thinkingLevel || "medium");
      setQuestion(result.question ?? null);
      setPlan(result.plan ?? null);
      if (panel === "plan" && !result.plan) setPanel(null);
      setPlanDismissed(false);
      setQueued(result.queued ?? []);
      setMode(result.mode);
      setBusy(result.busy ?? false);
    });
  }
  async function openFolder() {
    await run(async () => {
      setProject(await api("project:open"));
      setEntries({});
      setFile(null);
      newChat();
      await refresh();
    });
  }
  async function loadFiles(relative = ".") {
    await run(async () => {
      const list = await api("files:list", { relative });
      setEntries((previous) => ({ ...previous, [relative]: list }));
    });
  }
  async function toggleFolder(entry) {
    if (expanded.has(entry.path))
      setExpanded((prev) => new Set([...prev].filter((p) => p !== entry.path)));
    else {
      await loadFiles(entry.path);
      setExpanded((prev) => new Set([...prev, entry.path]));
    }
  }
  useEffect(() => {
    if (file)
      fileBuffers.current.set(project + "/" + file.path, { content, original });
  }, [file, project, content, original]);
  useEffect(() => {
    if (!editorReady) return;
    const timer = setTimeout(() => {
      const buffers = [...fileBuffers.current].filter(
        ([, buffer]) => buffer.content !== buffer.original,
      );
      api("editor:save-state", {
        state: {
          files: openFiles,
          buffers,
          activeFile: file ? project + "/" + file.path : null,
        },
      }).catch((error) => setError(error.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [openFiles, file, project, content, original, editorReady]);
  fileState.current = { path: file?.path, project, content, original };
  useEffect(() => {
    if (!file || content !== original) return;
    const initial = fileState.current;
    let cancelled = false;
    api("files:read", { relative: file.path })
      .then((value) => {
        const latest = fileState.current;
        if (
          !cancelled &&
          latest.path === initial.path &&
          latest.project === initial.project &&
          latest.content === initial.content &&
          latest.original === initial.original
        ) {
          setContent(value);
          setOriginal(value);
        }
      })
      .catch((error) => setError(error.message));
    return () => {
      cancelled = true;
    };
  }, [fileRevision, file?.path, project]);
  async function openFile(entry, location = null) {
    const request = ++fileRequest.current;
    await run(async () => {
      const key = project + "/" + entry.path;
      const cached = fileBuffers.current.get(key);
      const dirty = cached && cached.content !== cached.original;
      const value = dirty
        ? cached.content
        : await api("files:read", { relative: entry.path });
      if (request !== fileRequest.current) return;
      setEditorLocation(location);
      setOpenFiles((items) =>
        items.some((item) => item.key === key)
          ? items
          : [...items, { ...entry, key, cwd: project }],
      );
      setFile(entry);
      setContent(value);
      setOriginal(dirty ? cached.original : value);
    });
  }
  async function closeFile(entry) {
    const buffer = fileBuffers.current.get(entry.key);
    if (
      buffer &&
      buffer.content !== buffer.original &&
      !confirm("Discard unsaved changes to " + entry.name + "?")
    )
      return;
    const remaining = openFiles.filter((item) => item.key !== entry.key);
    setOpenFiles(remaining);
    fileBuffers.current.delete(entry.key);
    if (file?.path === entry.path) {
      const next = remaining.filter((item) => item.cwd === project).at(-1);
      if (next) await openFile(next);
      else {
        setFile(null);
        setContent("");
        setOriginal("");
      }
    }
  }
  async function createEntry(directory, parent = ".") {
    const relative = await requestText(
      directory ? "New folder" : "New file",
      parent === "." ? "" : parent + "/",
    );
    if (!relative) return;
    await run(async () => {
      const entry = await api("files:create", { relative, directory });
      await loadFiles();
      const segments = relative.split("/").slice(0, -1);
      const folders = segments.map((_, index) =>
        segments.slice(0, index + 1).join("/"),
      );
      for (const folder of folders) await loadFiles(folder);
      setExpanded((previous) => new Set([...previous, ...folders]));
      if (!directory) await openFile(entry);
    });
  }
  async function renameEntry(entry) {
    setFileMenu(null);
    await run(async () => {
      const affected = openFiles.filter(
        (item) =>
          item.cwd === project &&
          (item.path === entry.path || item.path.startsWith(entry.path + "/")),
      );
      if (
        affected.some((item) => {
          const buffer = fileBuffers.current.get(item.key);
          return buffer && buffer.content !== buffer.original;
        })
      )
        throw new Error(
          "Save your open changes before renaming this file or folder.",
        );
      const destination = await requestText("Rename " + entry.name, entry.path);
      if (!destination || destination === entry.path) return;
      const next = await api("files:rename", {
        relative: entry.path,
        destination,
      });
      setOpenFiles((items) =>
        items.filter(
          (item) => !affected.some((other) => other.key === item.key),
        ),
      );
      affected.forEach((item) => fileBuffers.current.delete(item.key));
      if (file && affected.some((item) => item.path === file.path))
        setFile(null);
      setEntries({});
      setExpanded(new Set(["."]));
      await loadFiles();
      if (!next.directory) await openFile(next);
    });
  }
  const fileTree = (relative = ".", depth = 0) =>
    (entries[relative] ?? []).map((entry) => (
      <React.Fragment key={entry.path}>
        <button
          onContextMenu={(e) => {
            e.preventDefault();
            setFileMenu({
              entry,
              x: Math.min(e.clientX, window.innerWidth - 190),
              y: Math.min(e.clientY, window.innerHeight - 200),
            });
          }}
          className={`file-row ${file?.path === entry.path ? "selected" : ""}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() =>
            entry.directory ? toggleFolder(entry) : openFile(entry)
          }
        >
          {entry.directory ? (
            expanded.has(entry.path) ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : (
            <FileText size={13} />
          )}{" "}
          {entry.name}
        </button>
        {entry.directory &&
          expanded.has(entry.path) &&
          fileTree(entry.path, depth + 1)}
      </React.Fragment>
    ));
  function closeWorkspaceTab(tab) {
    if (!tab) return;
    if (tab.terminalId) {
      if (terminalTabs.filter((item) => item.cwd === project).length === 1) {
        const remaining = panelTabs.filter((type) => type !== "terminal");
        setPanelTabs(remaining);
        if (panel === "terminal") setPanel(remaining.at(-1) || null);
      }
      run(() => api("terminal:close", { id: tab.terminalId }));
      return;
    }
    if (tab.browserId) {
      run(() => api("browser:close", { id: tab.browserId }));
      return;
    }
    if (tab.entry) {
      closeFile(tab.entry);
      return;
    }
    const remaining = panelTabs.filter((type) => type !== tab.type);
    setPanelTabs(remaining);
    if (panel === tab.type) setPanel(remaining.at(-1) || null);
  }
  uiCommands.current = {
    designPrompt: (selected) =>
      submit({ text: selected.prompt, selection: selected }),
    settings: () => {
      setAccountMenu(false);
      setSettings(true);
    },
    new: newChat,
    openProject: openFolder,
    newTerminal: () => {
      setPanel("terminal");
      void newTerminal();
    },
    newBrowser: () =>
      run(async () => {
        setPanel("browser");
        await api("browser:new");
      }),
    closeTab: () => {
      if (panel) closeWorkspaceTab(workspaceTabs.find((tab) => tab.selected));
    },
    nextTab: () => cycleWorkspaceTab(1),
    previousTab: () => cycleWorkspaceTab(-1),
    search: () => setSearchOpen(true),
    sidebar: () => setSidebar((value) => !value),
    files: () => setPanel("files"),
    terminal: () => setPanel("terminal"),
    browser: () => setPanel("browser"),
    design: () =>
      run(async () => {
        setPanel("browser");
        await api("browser:inspect");
      }),
  };
  const activeBrowser = browserTabs.find((tab) => tab.id === browserActive);
  const browserCovered = !!(
    accountMenu ||
    shortcutsOpen ||
    settings ||
    question ||
    tabMenu ||
    contextMenu ||
    chatMenu ||
    modelMenu ||
    searchOpen ||
    textDialog ||
    browserMenu ||
    imagePreview ||
    splitOverlay ||
    projectMenu
  );
  const workspaceTabs = panelTabs
    .filter((type) => type !== "plan" || plan)
    .flatMap((type) => {
      if (
        type === "terminal" &&
        terminalTabs.some((tab) => tab.cwd === project)
      )
        return terminalTabs
          .filter((tab) => tab.cwd === project)
          .map((tab, index) => ({
            key: "terminal:" + tab.id,
            type,
            title: index ? "Terminal " + (index + 1) : "Terminal",
            terminalId: tab.id,
            selected: panel === type && tab.id === terminalActive,
          }));
      if (type === "browser" && browserTabs.length)
        return browserTabs.map((tab) => ({
          key: "browser:" + tab.id,
          type,
          title: tab.title || "Browser",
          browserId: tab.id,
          selected: panel === type && tab.id === browserActive,
        }));
      if (type === "files" && openFiles.some((item) => item.cwd === project))
        return openFiles
          .filter((item) => item.cwd === project)
          .map((item) => ({
            key: item.key,
            type,
            title: item.name,
            entry: item,
            selected: panel === type && item.path === file?.path,
          }));
      return [
        {
          key: type,
          type,
          title:
            type === "plan"
              ? plan?.title || "Plan"
              : type[0].toUpperCase() + type.slice(1),
          selected: panel === type,
        },
      ];
    });
  function cycleWorkspaceTab(direction) {
    if (!workspaceTabs.length) return;
    const index = workspaceTabs.findIndex((tab) => tab.selected);
    const tab =
      workspaceTabs[
        (index + direction + workspaceTabs.length) % workspaceTabs.length
      ];
    setPanel(tab.type);
    if (tab.terminalId) setTerminalActive(tab.terminalId);
    if (tab.browserId) run(() => api("browser:select", { id: tab.browserId }));
    if (tab.entry) openFile(tab.entry);
    if (tab.type === "changes")
      run(async () => setChangeList(await api("project:changes")));
  }
  return (
    <div className={`app ${sidebar ? "" : "sidebar-hidden"}`}>
      {textDialog && <TextDialog {...textDialog} />}
      {shortcutsOpen && (
        <div className="modal-backdrop" onClick={() => setShortcutsOpen(false)}>
          <section
            className="modal shortcuts-dialog"
            role="dialog"
            aria-label="Keyboard shortcuts"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Shortcuts</h2>
              <IconButton
                title="Close shortcuts"
                onClick={() => setShortcutsOpen(false)}
              >
                <X size={16} />
              </IconButton>
            </div>
            {[
              ["New chat", "⌘N"],
              ["Search chats", "⌘K"],
              ["Open folder", "⌘O"],
              ["New browser", "⌘T"],
              ["Close tab", "⌘W"],
              ["Next / previous tab", "⌃Tab / ⌃⇧Tab"],
              ["Toggle sidebar", "⌘B"],
              ["Files", "⌘G"],
              ["Terminal", "⌘J"],
              ["Browser", "⌘⇧B"],
              ["Design Mode", "⌘⇧D"],
              ["Settings", "⌘,"],
              ["Plan mode", "⇧Tab"],
              ["Save file", "⌘S"],
              ["Add selection to chat", "⌘L"],
            ].map(([name, key]) => (
              <div className="shortcut-row" key={name}>
                <span>{name}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </section>
        </div>
      )}
      {projectMenu && (
        <>
          <div className="menu-dismiss" onClick={() => setProjectMenu(null)} />
          <div
            className="popover file-context-menu"
            style={{ left: projectMenu.x, top: projectMenu.y }}
          >
            <button
              onClick={() =>
                run(async () => {
                  const removed = projectMenu.cwd;
                  const result = await api("project:remove", { cwd: removed });
                  setProjectMenu(null);
                  setProjects(result.projects);
                  setProject(result.project);
                  setGit(result.git);
                  if (removed === project) {
                    newChat();
                    setEntries({});
                    setFile(null);
                    setPanel(null);
                  }
                  await refresh();
                })
              }
            >
              Close project
            </button>
          </div>
        </>
      )}
      {fileMenu && (
        <>
          <div className="menu-dismiss" onMouseDown={() => setFileMenu(null)} />
          <div
            className="popover file-context-menu"
            style={{ left: fileMenu.x, top: fileMenu.y }}
          >
            {fileMenu.entry.directory && (
              <>
                <button
                  onClick={() => {
                    const entry = fileMenu.entry;
                    setFileMenu(null);
                    createEntry(false, entry.path);
                  }}
                >
                  New File…
                </button>
                <button
                  onClick={() => {
                    const entry = fileMenu.entry;
                    setFileMenu(null);
                    createEntry(true, entry.path);
                  }}
                >
                  New Folder…
                </button>
              </>
            )}
            <button onClick={() => renameEntry(fileMenu.entry)}>Rename…</button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(fileMenu.entry.path);
                setFileMenu(null);
              }}
            >
              Copy Relative Path
            </button>
            <button
              onClick={() => {
                run(() =>
                  api("files:reveal", { relative: fileMenu.entry.path }),
                );
                setFileMenu(null);
              }}
            >
              Reveal in Finder
            </button>
          </div>
        </>
      )}
      {searchOpen && (
        <SearchDialog
          history={history}
          onClose={() => setSearchOpen(false)}
          onSelect={(item) => {
            setSearchOpen(false);
            openConversation(item);
          }}
          onRestore={(item) =>
            run(async () => {
              await api("conversation:update", {
                id: item.id,
                archived: false,
              });
              await refresh();
            })
          }
        />
      )}
      <header className="titlebar" style={{ width: sidebar ? sideWidth : 220 }}>
        <span className="traffic-space" />
        <IconButton title="Toggle sidebar" onClick={() => setSidebar(!sidebar)}>
          <PanelLeft size={15} />
        </IconButton>
        <span className="spacer" />
        <IconButton
          title="Go Back"
          disabled={navigationIndex === 0}
          onClick={() => navigateChat(-1)}
        >
          <ArrowLeft size={13} />
        </IconButton>
        <IconButton
          title="Go Forward"
          disabled={navigationIndex >= navigation.current.length - 1}
          onClick={() => navigateChat(1)}
        >
          <ArrowRight size={13} />
        </IconButton>
        <span className="window-title">Glass</span>
        <span className="title-project">{project.split("/").pop()}</span>
      </header>
      <div
        className={`workspace ${panelExpanded && panel ? "panel-expanded" : ""}`}
      >
        {sidebar && (
          <aside className="sidebar" style={{ width: sideWidth }}>
            <button className="new-chat" onClick={newChat}>
              <Plus size={16} />
              New Chat<span>⌘N</span>
            </button>
            <button
              className="search search-trigger"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={14} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <div className="sidebar-label">
              Repositories
              <IconButton title="Open project" onClick={openFolder}>
                <Plus size={13} />
              </IconButton>
            </div>
            <div className="history">
              {projects.map((cwd) => (
                <div className="repository-group" key={cwd}>
                  <button
                    className="project"
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setProjectMenu({
                        cwd,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                    onClick={() => {
                      setCollapsedProjects((previous) => {
                        const next = new Set(previous);
                        next.has(cwd) ? next.delete(cwd) : next.add(cwd);
                        return next;
                      });
                    }}
                  >
                    {collapsedProjects.has(cwd) ? (
                      <Folder size={13} />
                    ) : (
                      <FolderOpen size={13} />
                    )}
                    <span>{cwd.split("/").pop()}</span>
                    <Plus
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        run(async () => {
                          const result = await api("project:select", { cwd });
                          setProject(result.project);
                          setGit(result.git);
                          newChat();
                        });
                      }}
                    />
                  </button>
                  {!collapsedProjects.has(cwd) &&
                    history
                      .filter(
                        (item) =>
                          item.cwd === cwd &&
                          !item.archived &&
                          item.title
                            .toLowerCase()
                            .includes(filter.toLowerCase()),
                      )
                      .sort(
                        (a, b) =>
                          Number(!!b.pinned) - Number(!!a.pinned) ||
                          (b.updatedAt || b.createdAt) -
                            (a.updatedAt || a.createdAt),
                      )
                      .map((item) => (
                        <div
                          className={`history-row ${item.id === active ? "selected" : ""} ${item.completedAt > (item.readAt || 0) && item.id !== active ? "unread" : ""}`}
                          key={item.id}
                        >
                          <button
                            className="history-title"
                            onClick={() => openConversation(item)}
                          >
                            {item.busy && (
                              <span
                                className={
                                  item.waiting
                                    ? "activity-dot waiting"
                                    : "activity-dot running"
                                }
                                aria-label={
                                  item.waiting
                                    ? "Waiting for answer"
                                    : "Working"
                                }
                              />
                            )}
                            <span>{item.title}</span>
                          </button>
                          <div className="history-hover">
                            <IconButton
                              title={
                                item.pinned
                                  ? "Unpin conversation"
                                  : "Pin conversation"
                              }
                              onClick={() =>
                                run(async () => {
                                  await api("conversation:update", {
                                    id: item.id,
                                    pinned: !item.pinned,
                                  });
                                  await refresh();
                                })
                              }
                            >
                              <Pin size={11} />
                            </IconButton>
                            <IconButton
                              title="Archive conversation"
                              onClick={() =>
                                run(async () => {
                                  await api("conversation:update", {
                                    id: item.id,
                                    archived: true,
                                  });
                                  if (active === item.id) newChat();
                                  await refresh();
                                })
                              }
                            >
                              <Archive size={11} />
                            </IconButton>
                          </div>
                          <span className="history-age">
                            {relativeAge(item.updatedAt || item.createdAt)}
                          </span>
                        </div>
                      ))}
                </div>
              ))}
            </div>
            <div className="account-footer">
              {accountMenu && (
                <>
                  <div
                    className="menu-dismiss"
                    onClick={() => setAccountMenu(false)}
                  />
                  <div
                    className="glass-account-menu"
                    role="menu"
                    aria-label="Glass"
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setAccountMenu(false);
                        setSettings(true);
                      }}
                    >
                      <Settings size={16} />
                      Settings<span>⌘,</span>
                    </button>
                    <hr />
                    <button
                      role="menuitem"
                      onClick={() => {
                        setAccountMenu(false);
                        run(() =>
                          api("external:open", {
                            url: "https://github.com/Baker-Harrison/Glass#readme",
                          }),
                        );
                      }}
                    >
                      <BookOpen size={16} />
                      Docs
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setAccountMenu(false);
                        setShortcutsOpen(true);
                      }}
                    >
                      <Keyboard size={16} />
                      Shortcuts
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setAccountMenu(false);
                        run(() =>
                          api("external:open", {
                            url: "https://github.com/Baker-Harrison/Glass/issues/new/choose",
                          }),
                        );
                      }}
                    >
                      <MessageSquare size={16} />
                      Contact Us
                    </button>
                    <hr />
                    <button
                      role="menuitem"
                      disabled={!models.length}
                      onClick={() => {
                        setAccountMenu(false);
                        run(async () => {
                          await api("auth:logout");
                          setModels([]);
                          setModel("");
                        });
                      }}
                    >
                      <LogOut size={16} />
                      Log Out
                    </button>
                  </div>
                </>
              )}

              <button
                className="account-profile"
                aria-label="Glass menu"
                aria-expanded={accountMenu}
                onClick={() => setAccountMenu((value) => !value)}
              >
                <img className="account-avatar" src={glassLogo} alt="" />
                <span className="account-name">{profile.displayName}</span>
              </button>
              {features.updateAvailable && (
                <button
                  className="account-update"
                  onClick={() => setSettings(true)}
                >
                  Update
                </button>
              )}
              <IconButton title="Settings" onClick={() => setSettings(true)}>
                <Settings size={15} />
              </IconButton>
            </div>
          </aside>
        )}
        {sidebar && (
          <div
            className="sidebar-resizer"
            role="separator"
            aria-label="Resize sidebar"
            onPointerDown={resizeSidebar}
          />
        )}
        <div
          className={`chat-group ${split ? "split-" + split.direction : ""}`}
        >
          <main className={`chat ${messages.length === 0 ? "empty-chat" : ""}`}>
            <div className="chat-toolbar">
              <button
                className="chat-title"
                disabled={!active}
                title="Rename conversation"
                onClick={() =>
                  run(async () => {
                    const title = await requestText(
                      "Rename conversation",
                      history.find((c) => c.id === active)?.title,
                    );
                    if (title) {
                      await api("conversation:update", { id: active, title });
                      await refresh();
                    }
                  })
                }
              >
                {history.find((c) => c.id === active)?.title ||
                  "New conversation"}
              </button>
              <div className="chat-actions-anchor">
                {active && (
                  <>
                    <IconButton
                      title="Chat actions"
                      onClick={() => setChatMenu(!chatMenu)}
                    >
                      <MoreHorizontal size={15} />
                    </IconButton>
                    {chatMenu && (
                      <div className="popover chat-actions-menu">
                        <button
                          onClick={() => {
                            setSplit({ direction: "right", id: active });
                            setChatMenu(false);
                          }}
                        >
                          Split Right
                        </button>
                        <button
                          onClick={() => {
                            setSplit({ direction: "down", id: active });
                            setChatMenu(false);
                          }}
                        >
                          Split Down
                        </button>
                        <button
                          onClick={() =>
                            run(async () => {
                              const title = await requestText(
                                "Rename conversation",
                                history.find((c) => c.id === active)?.title,
                              );
                              if (title)
                                await api("conversation:update", {
                                  id: active,
                                  title,
                                });
                              setChatMenu(false);
                              await refresh();
                            })
                          }
                        >
                          Rename
                        </button>
                        <button
                          onClick={() =>
                            run(async () => {
                              await api("conversation:update", {
                                id: active,
                                pinned: !history.find((c) => c.id === active)
                                  ?.pinned,
                              });
                              setChatMenu(false);
                              await refresh();
                            })
                          }
                        >
                          Pin
                        </button>
                        <button
                          onClick={() =>
                            run(async () => {
                              await api("conversation:update", {
                                id: active,
                                archived: true,
                              });
                              setChatMenu(false);
                              newChat();
                              await refresh();
                            })
                          }
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </>
                )}
                {!panel && (
                  <IconButton
                    title="Show Apps"
                    onClick={() =>
                      appsVisible
                        ? setPanel(lastPanel.current)
                        : setAppsVisible(true)
                    }
                  >
                    <PanelLeft size={14} />
                  </IconButton>
                )}
              </div>
            </div>
            <div
              className="conversation"
              ref={conversationScroll}
              onScroll={(e) => {
                const el = e.currentTarget;
                shouldFollow.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 100;
              }}
            >
              {messages.length === 0 ? (
                <div className="welcome" />
              ) : (
                <div className="messages">
                  <Conversation
                    stoppedTurns={
                      history.find((item) => item.id === active)
                        ?.stoppedTurns || []
                    }
                    onOpenImage={setImagePreview}
                    onOpenPlan={() => setPanel("plan")}
                    onOpenLink={(url) =>
                      run(async () => {
                        setPanel("browser");
                        await api("browser:navigate", { url });
                      })
                    }
                    messages={messages}
                    busy={busy}
                    onRetry={(text, user, context, files) => {
                      setFileContexts(files || []);
                      setEditing({
                        timestamp: user.timestamp,
                        previousDraft: editing?.previousDraft ?? draft,
                        previousSelection: editing
                          ? editing.previousSelection
                          : selection,
                        previousFiles: editing?.previousFiles ?? fileContexts,
                      });
                      setDraft(text);
                      setSelection(
                        context
                          ? {
                              ...context,
                              image: user.content?.find?.(
                                (part) => part.type === "image",
                              ),
                            }
                          : null,
                      );
                      composer.current?.focus();
                    }}
                    onFork={(turn) =>
                      run(async () => {
                        const result = await api("agent:fork", {
                          id: active,
                          timestamp: turn.messages.at(-1)?.timestamp,
                        });
                        setActive(result.id);
                        activeRef.current = result.id;
                        setMessages(result.messages);
                        setMode(result.mode);
                        setModel(result.modelId);
                        setEffort(result.thinkingLevel || "medium");
                        setQuestion(result.question || null);
                        setPlan(result.plan || null);
                        setQueued(result.queued || []);
                        setEditing(null);
                        setDraft("");
                        setSelection(null);
                        setFileContexts([]);
                        setBusy(false);
                        await refresh();
                      })
                    }
                  />
                  <div ref={bottom} />
                </div>
              )}
            </div>
            <div className="composer-region">
              <div className="composer-project">
                <button onClick={openFolder}>
                  {project.split("/").pop() || "Open project"}{" "}
                  <ChevronDown size={11} />
                </button>
                {git.branch && (
                  <span>
                    <GitBranch size={11} />
                    {git.branch}
                  </span>
                )}
              </div>
              {error && (
                <div className="error" role="alert">
                  {error}
                  <IconButton
                    title="Dismiss error"
                    onClick={() => setError("")}
                  >
                    <X size={13} />
                  </IconButton>
                </div>
              )}
              {question && question.sessionId !== "auth" && (
                <Question
                  key={question.id}
                  question={question}
                  onAnswer={(answers) =>
                    run(async () => {
                      await api("question:answer", {
                        sessionId: question.sessionId,
                        id: question.id,
                        answers,
                      });
                      setQuestion(null);
                    })
                  }
                />
              )}
              {mode === "plan" && plan && !planDismissed && (
                <div className="plan-review">
                  <div>
                    <span>Review Plan</span>
                    <IconButton
                      title="Dismiss plan"
                      onClick={() => setPlanDismissed(true)}
                    >
                      <X size={11} />
                    </IconButton>
                  </div>
                  <button onClick={() => setPanel("plan")}>{plan.title}</button>
                  <p>{plan.summary}</p>
                  <footer>
                    <button
                      className="build-plan"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api("plan:build", { id: active });
                          setMode("agent");
                          setBusy(true);
                        })
                      }
                    >
                      Build <span>⌘↵</span>
                    </button>
                  </footer>
                </div>
              )}
              {queued.length > 0 && (
                <div className="queued-messages">
                  <span>Queued</span>
                  {queued.map((text, index) => (
                    <p key={index}>{text}</p>
                  ))}
                  <button
                    onClick={() =>
                      run(async () => {
                        const result = await api("agent:queue:clear", {
                          id: active,
                        });
                        setDraft(result.join("\n\n"));
                        setQueued([]);
                        composer.current?.focus();
                      })
                    }
                  >
                    Edit queued messages
                  </button>
                </div>
              )}
              <div
                className={`composer ${messages.length && !draft.includes("\n") && draft.length < 100 && !selection && !fileContexts.length && !editing ? "compact" : ""}`}
              >
                {editing && (
                  <div className="editing-message">
                    <span>Editing message</span>
                    <button
                      onClick={() => {
                        setDraft(editing.previousDraft);
                        setSelection(editing.previousSelection);
                        setFileContexts(editing.previousFiles || []);
                        setEditing(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {fileContexts.map((context, index) => (
                  <div
                    className="selection-chip"
                    key={context.path + ":" + context.startLine}
                  >
                    <FileText size={12} />
                    <span>
                      {context.path.split("/").pop()}
                      {context.startLine
                        ? `:${context.startLine}${context.endLine !== context.startLine ? `–${context.endLine}` : ""}`
                        : ""}
                    </span>
                    <IconButton
                      title="Remove file context"
                      onClick={() =>
                        setFileContexts((items) =>
                          items.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X size={12} />
                    </IconButton>
                  </div>
                ))}
                {selection && (
                  <div className="selection-chip">
                    {selection.image ? (
                      <img
                        className="selection-thumbnail"
                        src={`data:image/png;base64,${selection.image.data}`}
                        alt="Selected page"
                      />
                    ) : (
                      <MousePointer2 size={12} />
                    )}
                    <span>{selection.selector}</span>
                    <IconButton
                      title="Remove selected element"
                      onClick={() => setSelection(null)}
                    >
                      <X size={12} />
                    </IconButton>
                  </div>
                )}
                <textarea
                  ref={composer}
                  aria-label="Message"
                  placeholder={
                    mode === "plan"
                      ? "Plan changes"
                      : mode === "ask"
                        ? "Ask a question"
                        : messages.length
                          ? "Send follow-up"
                          : "Plan, Build, @ for context"
                  }
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                <div className="composer-bottom">
                  <div className="context-anchor">
                    <IconButton
                      title="Add context"
                      onClick={() => setContextMenu(!contextMenu)}
                    >
                      <Plus size={14} />
                    </IconButton>
                    {contextMenu && (
                      <div className="popover context-menu">
                        <div className="context-search">
                          Add context or choose a mode
                        </div>
                        {[
                          {
                            id: "plan",
                            label: "Plan",
                            description: "Generate an implementation plan",
                          },
                          {
                            id: "ask",
                            label: "Ask",
                            description:
                              "Answer questions without making edits",
                          },
                          {
                            id: "agent",
                            label: "Agent",
                            description: "Make changes in your project",
                          },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() =>
                              run(async () => {
                                if (active)
                                  await api("agent:mode", {
                                    id: active,
                                    mode: item.id,
                                  });
                                setMode(item.id);
                                setContextMenu(false);
                              })
                            }
                          >
                            <span className={"context-mode " + item.id}>
                              {item.label}
                            </span>
                            <small>{item.description}</small>
                          </button>
                        ))}
                        {file && (
                          <button
                            onClick={() => {
                              setFileContexts((items) => [
                                ...items.filter(
                                  (item) =>
                                    item.path !== project + "/" + file.path,
                                ),
                                { path: project + "/" + file.path },
                              ]);
                              setContextMenu(false);
                            }}
                          >
                            <FileText size={12} /> Add current file
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPanel("files");
                            loadFiles();
                            setContextMenu(false);
                          }}
                        >
                          <Files size={12} /> Files
                        </button>
                      </div>
                    )}
                  </div>
                  {mode !== "agent" && (
                    <button
                      className={"mode-chip " + mode}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (active)
                            await api("agent:mode", {
                              id: active,
                              mode: "agent",
                            });
                          setMode("agent");
                        })
                      }
                    >
                      {mode === "plan" ? "☷ Plan" : "◉ Ask"} <X size={10} />
                    </button>
                  )}
                  {models.length === 0 ? (
                    <button
                      className="connect-model"
                      onClick={() => setSettings(true)}
                    >
                      Connect ChatGPT <ChevronDown size={11} />
                    </button>
                  ) : (
                    <ModelPicker
                      models={models}
                      model={model}
                      effort={effort}
                      busy={busy}
                      onOpenChange={setModelMenu}
                      onSelect={(id) =>
                        run(async () => {
                          if (active)
                            await api("agent:model", {
                              id: active,
                              modelId: id,
                            });
                          setModel(id);
                        })
                      }
                      onEffort={(level) =>
                        run(async () => {
                          if (active)
                            await api("agent:model", {
                              id: active,
                              thinkingLevel: level,
                            });
                          setEffort(level);
                        })
                      }
                    />
                  )}
                  <span className="spacer" />
                  {busy && (
                    <IconButton
                      title="Stop response"
                      onClick={() =>
                        run(async () => {
                          const pending = await api("agent:stop", {
                            id: active,
                          });
                          if (pending?.length)
                            setDraft((current) =>
                              [...pending, current]
                                .filter(Boolean)
                                .join("\n\n"),
                            );
                        })
                      }
                    >
                      <Square size={13} />
                    </IconButton>
                  )}
                  <button
                    className="send"
                    aria-label={busy ? "Queue message" : "Send message"}
                    disabled={!draft.trim()}
                    onClick={submit}
                  >
                    <ArrowUp size={17} />
                  </button>
                </div>
              </div>
              <div className="composer-hint">
                <button
                  className={mode === "plan" ? "mode-pill active" : "mode-pill"}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const next = mode === "plan" ? "agent" : "plan";
                      if (active)
                        await api("agent:mode", { id: active, mode: next });
                      setMode(next);
                    })
                  }
                >
                  {mode === "plan" ? "Plan mode" : "Plan New Idea"}{" "}
                  <span>⇧Tab</span>
                </button>
                {active &&
                  history.find((item) => item.id === active)?.contextUsage
                    ?.percent != null && (
                    <span
                      className="context-usage"
                      title={`${Math.round(history.find((item) => item.id === active).contextUsage.tokens).toLocaleString()} of ${history.find((item) => item.id === active).contextUsage.contextWindow.toLocaleString()} context tokens (estimated)`}
                    >
                      Context{" "}
                      {Math.round(
                        history.find((item) => item.id === active).contextUsage
                          .percent,
                      )}
                      %
                    </span>
                  )}
              </div>
            </div>
          </main>
          {split && (
            <SplitChat
              key={project}
              initialId={split.id}
              history={history}
              models={models}
              project={project}
              file={file}
              onClose={() => {
                setSplit(null);
                setSplitOverlay(false);
              }}
              onSelect={(id) =>
                setSplit((value) => (value ? { ...value, id } : value))
              }
              onRefresh={() => run(refresh)}
              onOpenLink={(url) =>
                run(async () => {
                  setPanel("browser");
                  await api("browser:navigate", { url });
                })
              }
              onOpenImage={setImagePreview}
              onOverlayChange={setSplitOverlay}
            />
          )}
        </div>
        {!panel && appsVisible && (
          <aside className="apps-launcher" aria-label="Apps">
            <button
              className="apps-collapse"
              aria-label="Collapse Apps list"
              onClick={() => setAppsVisible(false)}
            >
              <ChevronRight size={12} />
            </button>
            {workspaceTabs.length > 0 && (
              <>
                <p>Open Tabs</p>
                {workspaceTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setPanel(tab.type);
                      if (tab.browserId)
                        run(() => api("browser:select", { id: tab.browserId }));
                      if (tab.terminalId) setTerminalActive(tab.terminalId);
                      if (tab.entry) openFile(tab.entry);
                      if (tab.type === "changes")
                        run(async () =>
                          setChangeList(await api("project:changes")),
                        );
                    }}
                  >
                    {tab.type === "browser" ? (
                      <Globe size={13} />
                    ) : tab.type === "terminal" ? (
                      <Terminal size={13} />
                    ) : (
                      <FileText size={13} />
                    )}
                    <span>{tab.title}</span>
                  </button>
                ))}
              </>
            )}
            <p>On {project.split("/").pop()}</p>
            {[
              { type: "changes", title: "Changes", Icon: GitBranch },
              { type: "browser", title: "Browser", Icon: Globe },
              { type: "terminal", title: "Terminal", Icon: Terminal },
              { type: "files", title: "Files", Icon: Files },
            ].map(({ type, title, Icon }) => (
              <button
                key={type}
                onClick={() => {
                  setPanel(type);
                  if (type === "files") loadFiles();
                  if (type === "changes")
                    run(async () =>
                      setChangeList(await api("project:changes")),
                    );
                }}
              >
                <Icon size={13} />
                <span>{title}</span>
              </button>
            ))}
          </aside>
        )}
        {panel && (
          <section
            className="work-panel"
            style={{
              width: panelExpanded ? "100%" : panelWidth + "%",
              maxWidth: panelExpanded
                ? "100%"
                : `calc(100% - ${(sidebar ? sideWidth : 0) + (split?.direction === "right" ? 360 : 260)}px)`,
            }}
          >
            <div
              className="panel-resizer"
              role="separator"
              aria-label="Resize panel"
              onPointerDown={resizePanel}
            />
            <div className="workspace-tabs" role="tablist">
              {workspaceTabs.map((tab) => (
                <div
                  className={`workspace-tab ${tab.selected ? "selected" : ""}`}
                  key={tab.key}
                >
                  <button
                    role="tab"
                    aria-selected={tab.selected}
                    title={tab.entry?.path || tab.title}
                    onClick={() => {
                      setPanel(tab.type);
                      if (tab.terminalId) setTerminalActive(tab.terminalId);
                      if (tab.browserId)
                        run(() => api("browser:select", { id: tab.browserId }));
                      if (tab.entry) openFile(tab.entry);
                      if (tab.type === "changes")
                        run(async () =>
                          setChangeList(await api("project:changes")),
                        );
                    }}
                  >
                    {tab.type === "browser" ? (
                      <Globe size={12} />
                    ) : tab.type === "terminal" ? (
                      <Terminal size={12} />
                    ) : tab.type === "changes" ? (
                      <GitBranch size={12} />
                    ) : (
                      <FileText size={12} />
                    )}
                    <span>
                      {tab.title}
                      {tab.entry &&
                      (tab.selected
                        ? content !== original
                        : fileBuffers.current.get(tab.key)?.content !==
                          fileBuffers.current.get(tab.key)?.original)
                        ? " •"
                        : ""}
                    </span>
                  </button>
                  <IconButton
                    title={"Close " + tab.title}
                    onClick={() => closeWorkspaceTab(tab)}
                  >
                    <X size={11} />
                  </IconButton>
                </div>
              ))}
              <div className="tab-menu-anchor">
                <IconButton
                  title="Open new tab menu"
                  onClick={() => setTabMenu(!tabMenu)}
                >
                  <Plus size={13} />
                </IconButton>
                {tabMenu && (
                  <div className="popover tab-menu">
                    {["files", "terminal", "browser", "changes"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => {
                          setPanel(tab);
                          setTabMenu(false);
                          if (tab === "files") loadFiles();
                          if (tab === "terminal") void newTerminal();
                          if (tab === "browser") run(() => api("browser:new"));
                          if (tab === "changes")
                            run(async () =>
                              setChangeList(await api("project:changes")),
                            );
                        }}
                      >
                        {tab[0].toUpperCase() + tab.slice(1)}
                        <span>
                          {tab === "files"
                            ? "⌘G"
                            : tab === "terminal"
                              ? "⌘J"
                              : tab === "browser"
                                ? "⇧⌘B"
                                : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="spacer" />
              <IconButton
                title={panelExpanded ? "Restore panel" : "Expand panel"}
                onClick={() => setPanelExpanded(!panelExpanded)}
              >
                {panelExpanded ? (
                  <Minimize2 size={13} />
                ) : (
                  <Maximize2 size={13} />
                )}
              </IconButton>
              <IconButton title="Hide Apps" onClick={() => setPanel(null)}>
                <PanelLeft size={13} />
              </IconButton>
            </div>
            {panel === "browser" && (
              <>
                <form
                  className="browser-toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() =>
                      api("browser:navigate", {
                        url: browserAddress(url),
                      }),
                    );
                  }}
                >
                  <IconButton
                    disabled={!activeBrowser?.canGoBack}
                    title="Back"
                    onClick={() => api("browser:back")}
                  >
                    <ArrowLeft size={14} />
                  </IconButton>
                  <IconButton
                    title="Forward"
                    disabled={!activeBrowser?.canGoForward}
                    onClick={() => api("browser:forward")}
                  >
                    <ArrowRight size={14} />
                  </IconButton>
                  <IconButton
                    title="Reload"
                    onClick={() => api("browser:reload")}
                  >
                    <RotateCw size={14} />
                  </IconButton>
                  <input
                    aria-label="Browser address"
                    placeholder="Search or enter URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <IconButton
                    title={
                      bookmarks.some((item) => item.url === activeBrowser?.url)
                        ? "Remove bookmark"
                        : "Bookmark page"
                    }
                    disabled={!activeBrowser?.url}
                    active={bookmarks.some(
                      (item) => item.url === activeBrowser?.url,
                    )}
                    onClick={() =>
                      setBookmarks((items) =>
                        items.some((item) => item.url === activeBrowser.url)
                          ? items.filter(
                              (item) => item.url !== activeBrowser.url,
                            )
                          : [
                              ...items,
                              {
                                url: activeBrowser.url,
                                title: activeBrowser.title,
                              },
                            ],
                      )
                    }
                  >
                    <Star size={13} />
                  </IconButton>
                  <IconButton
                    title="History"
                    onClick={() =>
                      setBrowserMenu(
                        browserMenu === "history" ? null : "history",
                      )
                    }
                  >
                    <History size={14} />
                  </IconButton>
                  <IconButton
                    title="Bookmarks"
                    onClick={() =>
                      setBrowserMenu(
                        browserMenu === "bookmarks" ? null : "bookmarks",
                      )
                    }
                  >
                    <MoreHorizontal size={14} />
                  </IconButton>
                  <IconButton
                    title="Show Console"
                    active={browserConsole}
                    onClick={() => setBrowserConsole((value) => !value)}
                  >
                    <Terminal size={14} />
                  </IconButton>
                  <IconButton
                    title={
                      browserTabs.find((tab) => tab.id === browserActive)
                        ?.designActive
                        ? "Exit Design Mode (Esc)"
                        : "Design Mode (⌘⇧D)"
                    }
                    active={
                      !!browserTabs.find((tab) => tab.id === browserActive)
                        ?.designActive
                    }
                    onClick={() => run(() => api("browser:inspect"))}
                  >
                    <MousePointer2 size={15} />
                  </IconButton>
                </form>
                {browserMenu && (
                  <BrowserMenu
                    kind={browserMenu}
                    history={browserHistory}
                    bookmarks={bookmarks}
                    onClose={() => setBrowserMenu(null)}
                    onNavigate={(address) => {
                      setBrowserMenu(null);
                      run(() => api("browser:navigate", { url: address }));
                    }}
                    onRemove={(address) =>
                      setBookmarks((items) =>
                        items.filter((item) => item.url !== address),
                      )
                    }
                  />
                )}
                <div ref={browserBox} className="browser-content">
                  {browserCovered && browserSnapshot && activeBrowser?.url && (
                    <img
                      className="browser-snapshot"
                      src={browserSnapshot}
                      alt="Current browser page"
                    />
                  )}
                  {(!browserTabs.find((t) => t.id === browserActive)?.url ||
                    browserTabs.find((t) => t.id === browserActive)?.url ===
                      "about:blank") && (
                    <div className="browser-start">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() =>
                            api("browser:navigate", {
                              url: browserAddress(url),
                            }),
                          );
                        }}
                      >
                        <Search size={13} />
                        <input
                          aria-label="Search or enter URL"
                          placeholder="Search or enter URL…"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                      </form>
                      {browserHistory.length > 0 && <p>Recents</p>}
                      {browserHistory.slice(0, 8).map((address) => (
                        <button
                          key={address}
                          onClick={() =>
                            run(() => api("browser:navigate", { url: address }))
                          }
                        >
                          <Globe size={12} />
                          <span>{address.replace(/^https?:\/\//, "")}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {browserConsole && (
                  <BrowserConsole
                    tabId={browserActive}
                    onClose={() => setBrowserConsole(false)}
                  />
                )}
              </>
            )}
            {panel === "files" && (
              <div className="file-workspace">
                <div className="file-tree">
                  <div className="explorer-actions">
                    <span>{project.split("/").pop()}</span>
                    <IconButton
                      title="New file"
                      onClick={() => createEntry(false)}
                    >
                      <FilePlus size={13} />
                    </IconButton>
                    <IconButton
                      title="New folder"
                      onClick={() => createEntry(true)}
                    >
                      <FolderPlus size={13} />
                    </IconButton>
                  </div>
                  <form
                    className="file-search"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () =>
                        setMatches(
                          await api("project:search", { query: fileQuery }),
                        ),
                      );
                    }}
                  >
                    <Search size={12} />
                    <input
                      aria-label="Search in files"
                      placeholder="Search files…"
                      value={fileQuery}
                      onChange={(e) => {
                        setFileQuery(e.target.value);
                        if (!e.target.value) setMatches([]);
                      }}
                    />
                  </form>
                  {fileQuery &&
                    matches.map((match, index) => (
                      <button
                        className="search-result"
                        key={index}
                        onClick={() =>
                          openFile(
                            {
                              path: match.path,
                              name: match.path.split("/").pop(),
                            },
                            { line: match.line },
                          )
                        }
                      >
                        <strong>
                          {match.path}:{match.line}
                        </strong>
                        <span>{match.text}</span>
                      </button>
                    ))}
                  {fileTree()}
                </div>
                {file ? (
                  <div className="editor">
                    <div className="editor-header">
                      <span>
                        {file.path}
                        {content !== original ? " •" : ""}
                      </span>
                      <button
                        disabled={content === original}
                        onClick={() =>
                          run(async () => {
                            await api("files:save", {
                              relative: file.path,
                              expectedContent: original,
                              content,
                            });
                            setOriginal(content);
                          })
                        }
                      >
                        Save
                      </button>
                    </div>
                    <PanelBoundary>
                      <Suspense
                        fallback={
                          <div className="panel-empty">Opening editor…</div>
                        }
                      >
                        <CodeEditor
                          path={project + "/" + file.path}
                          value={content}
                          location={editorLocation}
                          onChange={setContent}
                          onSave={(value) =>
                            run(async () => {
                              await api("files:save", {
                                relative: file.path,
                                expectedContent: original,
                                content: value,
                              });
                              setOriginal(value);
                            })
                          }
                          onSelection={(selection) => {
                            setFileContexts((items) => [
                              ...items.filter(
                                (item) =>
                                  item.path !== selection.path ||
                                  item.startLine !== selection.startLine,
                              ),
                              {
                                ...selection,
                                text: selection.text.slice(0, 50000),
                              },
                            ]);
                            composer.current?.focus();
                          }}
                        />
                      </Suspense>
                    </PanelBoundary>
                  </div>
                ) : (
                  <div className="panel-empty">Select a file to open it.</div>
                )}
              </div>
            )}
            {panel === "plan" && plan && (
              <PlanPane
                plan={plan}
                busy={busy}
                onSave={(next) =>
                  run(async () => {
                    setPlan(next);
                    await api("plan:save", { id: active, plan: next });
                  })
                }
                onBuild={() =>
                  run(async () => {
                    await api("plan:build", { id: active });
                    setMode("agent");
                    setBusy(true);
                  })
                }
              />
            )}
            {panel === "changes" && (
              <ChangesPane
                changes={changeList}
                onRefresh={() =>
                  run(async () => setChangeList(await api("project:changes")))
                }
                onOpen={(item) => {
                  setPanel("files");
                  loadFiles();
                  openFile({
                    path: item.path,
                    name: item.path.split("/").pop(),
                  });
                }}
              />
            )}
            {panel === "terminal" &&
              terminalTabs.some(
                (tab) => tab.id === terminalActive && tab.cwd === project,
              ) && (
                <>
                  <div className="terminal-toolbar">
                    <span>Terminal</span>
                    <IconButton title="New Terminal" onClick={newTerminal}>
                      <Plus size={12} />
                    </IconButton>
                    <IconButton
                      title="Show terminal list"
                      onClick={() => setTerminalMenu((value) => !value)}
                    >
                      <PanelLeft size={12} />
                    </IconButton>
                    {terminalMenu && (
                      <>
                        <div
                          className="menu-dismiss"
                          onClick={() => setTerminalMenu(false)}
                        />
                        <div className="popover terminal-menu">
                          {terminalTabs
                            .filter((tab) => tab.cwd === project)
                            .map((tab, index) => (
                              <button
                                key={tab.id}
                                onClick={() => {
                                  setTerminalActive(tab.id);
                                  setTerminalMenu(false);
                                }}
                              >
                                <Terminal size={12} />
                                <span>
                                  Terminal {index + 1}
                                  {tab.exited ? " · Exited" : ""}
                                </span>
                                {tab.id === terminalActive && (
                                  <Check size={12} />
                                )}
                              </button>
                            ))}
                          <button
                            onClick={() => {
                              setTerminalMenu(false);
                              newTerminal();
                            }}
                          >
                            <Plus size={12} /> New Terminal
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <PanelBoundary>
                    <Suspense
                      fallback={
                        <div className="panel-empty">Opening terminal…</div>
                      }
                    >
                      <TerminalPane
                        terminalId={terminalActive}
                        api={api}
                        onError={setError}
                        project={project}
                      />
                    </Suspense>
                  </PanelBoundary>
                </>
              )}
          </section>
        )}
      </div>
      {imagePreview && (
        <div
          className="image-preview"
          role="dialog"
          aria-label="Screenshot preview"
          aria-modal="true"
          onClick={() => setImagePreview(null)}
        >
          <button
            autoFocus
            aria-label="Close screenshot preview"
            onClick={() => setImagePreview(null)}
          >
            <X size={20} />
          </button>
          <img
            src={imagePreview}
            alt="Browser screenshot"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <h2>Settings</h2>
              <IconButton
                title="Close settings"
                onClick={() => setSettings(false)}
              >
                <X size={16} />
              </IconButton>
            </div>
            <h3>ChatGPT account</h3>
            <p>
              Use your ChatGPT subscription through Pi’s OpenAI Codex provider.
            </p>
            <button
              className="primary"
              onClick={() => run(() => api("auth:login"))}
            >
              {models.length ? "Sign in again" : "Sign in with ChatGPT"}
            </button>
            {auth && (
              <div className="auth-progress">
                <p>
                  {auth.instructions ||
                    auth.message ||
                    "Finish signing in in your browser."}
                </p>
                {auth.url && (
                  <button
                    onClick={() =>
                      run(() => api("external:open", { url: auth.url }))
                    }
                  >
                    Open sign-in page
                  </button>
                )}
                <button
                  onClick={() =>
                    run(async () => {
                      await api("auth:cancel");
                      setAuth(null);
                    })
                  }
                >
                  Cancel
                </button>
              </div>
            )}
            {question?.sessionId === "auth" && (
              <Question
                key={question.id}
                question={question}
                onAnswer={(answers) =>
                  run(async () => {
                    await api("question:answer", {
                      sessionId: "auth",
                      id: question.id,
                      answers,
                    });
                    setQuestion(null);
                  })
                }
              />
            )}
            <h3>Project</h3>
            <p className="project-path">{project || "No project selected"}</p>
            <button onClick={openFolder}>Open folder…</button>
            {error && <p className="error">{error}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
