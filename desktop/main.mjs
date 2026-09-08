import {
  app,
  BaseWindow,
  WebContentsView,
  ipcMain,
  dialog,
  shell,
  Menu,
} from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import { readFile, writeFile, rename } from "node:fs/promises";
import { AgentWorkspace } from "./agent.mjs";
import { WorkspaceTerminal } from "./terminal.mjs";
import { WorkspaceBrowser } from "./browser.mjs";
import {
  gitInfo,
  changes,
  search,
  branches,
  switchBranch,
} from "./project.mjs";
import {
  listFiles,
  readProjectFile,
  saveProjectFile,
  createProjectEntry,
  renameProjectEntry,
  resolveProjectPath,
} from "./files.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
// Keep development and packaged launches on the same existing account store.
app.setPath("userData", path.join(app.getPath("appData"), "glass-agent"));
let win,
  mainContents,
  browser,
  agent,
  project = process.cwd(),
  loginController,
  terminal;
let conversations = [],
  editorState = { files: [], buffers: [], activeFile: null },
  projects = [process.cwd()];
const emit = (event) => {
  if (event.type === "agent_event" && event.event.type === "agent_end") {
    const item = conversations.find(
      (conversation) => conversation.id === event.sessionId,
    );
    if (item) {
      item.completedAt = Date.now();
      item.updatedAt = item.completedAt;
      void persist();
    }
  }
  if (event.type === "auth" && event.event.type === "auth_url")
    void shell.openExternal(event.event.url);
  if (win && !win.isDestroyed()) {
    if (event.type === "browser_selection") mainContents.focus();
    mainContents.send("glass:event", event);
  }
};
const metaPath = () => path.join(app.getPath("userData"), "workspace.json");
let saving = Promise.resolve();
const persist = () => {
  const snapshot = JSON.stringify({
    project,
    projects,
    conversations,
    editorState,
  });
  saving = saving
    .catch(() => {})
    .then(async () => {
      await writeFile(metaPath() + ".tmp", snapshot, { mode: 0o600 });
      await rename(metaPath() + ".tmp", metaPath());
    });
  return saving;
};
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, args) => {
    if (
      event.sender !== mainContents ||
      event.senderFrame !== mainContents.mainFrame
    )
      throw new Error("Unauthorized window");
    return fn(args ?? {});
  });
}
const validURL = (value) => {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Use an HTTP or HTTPS address");
  return url.href;
};
async function start() {
  await app.whenReady();
  app.setName("Glass");
  try {
    const saved = JSON.parse(await readFile(metaPath(), "utf8"));
    project = saved.project;
    conversations = saved.conversations ?? [];
    projects = saved.projects ?? [project];
    editorState = saved.editorState ?? editorState;
  } catch {}
  win = new BaseWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 620,
    title: "Glass",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f7f6f5",
  });
  const mainView = new WebContentsView({
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  mainContents = mainView.webContents;
  const command = (action) => {
    mainContents.focus();
    emit({ type: "ui_command", action });
  };
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Glass",
        submenu: [
          { role: "about", label: "About Glass" },
          {
            label: "Settings…",
            accelerator: "CmdOrCtrl+,",
            click: () => command("settings"),
          },
          { type: "separator" },
          { role: "hide", label: "Hide Glass" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit", label: "Quit Glass" },
        ],
      },
      {
        label: "File",
        submenu: [
          {
            label: "New Chat",
            accelerator: "CmdOrCtrl+N",
            click: () => command("new"),
          },
          {
            label: "Search Conversations",
            accelerator: "CmdOrCtrl+K",
            click: () => command("search"),
          },
          { type: "separator" },
          {
            label: "Open Folder…",
            accelerator: "CmdOrCtrl+O",
            click: () => command("openProject"),
          },
          { label: "New Terminal", click: () => command("newTerminal") },
          {
            label: "New Browser",
            accelerator: "CmdOrCtrl+T",
            click: () => command("newBrowser"),
          },
          { type: "separator" },
          {
            label: "Close Tab",
            accelerator: "CmdOrCtrl+W",
            click: () => command("closeTab"),
          },
          {
            role: "close",
            label: "Close Window",
            accelerator: "CmdOrCtrl+Shift+W",
          },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          {
            label: "Toggle Sidebar",
            accelerator: "CmdOrCtrl+B",
            click: () => command("sidebar"),
          },
          {
            label: "Files",
            accelerator: "CmdOrCtrl+G",
            click: () => command("files"),
          },
          {
            label: "Terminal",
            accelerator: "CmdOrCtrl+J",
            click: () => command("terminal"),
          },
          {
            label: "Browser",
            accelerator: "CmdOrCtrl+Shift+B",
            click: () => command("browser"),
          },
          { type: "separator" },
          {
            label: "Design Mode",
            accelerator: "CmdOrCtrl+Shift+D",
            click: () => command("design"),
          },
          {
            label: "Reload Glass",
            accelerator: "CmdOrCtrl+R",
            click: () =>
              mainContents.loadFile(path.join(here, "../dist/index.html")),
          },
          {
            label: "Next Tab",
            accelerator: "Ctrl+Tab",
            click: () => command("nextTab"),
          },
          {
            label: "Previous Tab",
            accelerator: "Ctrl+Shift+Tab",
            click: () => command("previousTab"),
          },
          { role: "togglefullscreen" },
        ],
      },
      { role: "windowMenu" },
    ]),
  );
  win.contentView.addChildView(mainView);
  const sizeMain = () => {
    const [width, height] = win.getContentSize();
    mainView.setBounds({ x: 0, y: 0, width, height });
  };
  sizeMain();
  win.on("resize", sizeMain);
  win.on("closed", () => {
    if (!mainContents.isDestroyed()) mainContents.close();
  });
  app.setAccessibilitySupportEnabled(true);
  mainContents.on("console-message", ({ level, message }) => {
    if (["warning", "error"].includes(level))
      console.error("[renderer]", message);
  });
  mainContents.on(
    "did-fail-load",
    (_event, code, description, _url, isMainFrame) => {
      if (isMainFrame) console.error("App load failed", code, description);
    },
  );
  mainContents.on("render-process-gone", (_event, details) =>
    console.error("Renderer exited", details),
  );
  mainContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainContents.on("will-navigate", (event) => event.preventDefault());
  agent = new AgentWorkspace(path.join(app.getPath("userData"), "agent"), emit);
  await agent.initialize();
  handle("state", async () => ({
    project,
    projects,
    conversations: conversations.map((item) => ({
      ...item,
      busy: agent.sessions.get(item.id)?.session.isStreaming || false,
      contextUsage: agent.sessions.get(item.id)?.session.getContextUsage(),
      waiting: agent.questions.pending(item.id).length > 0,
    })),
    editor: editorState,
    terminals: terminals.state(),
    models: await agent.models(),
    git: await gitInfo(project),
    browser: { tabs: embedded.state(), active: embedded.active },
  }));
  handle("editor:save-state", async ({ state }) => {
    if (!Array.isArray(state?.files) || !Array.isArray(state?.buffers))
      throw new Error("Invalid editor state");
    editorState = state;
    await persist();
  });
  handle("project:branches", ({ cwd }) => {
    if (cwd !== project)
      throw new Error("The active project changed. Reopen the branch menu.");
    return branches(project);
  });
  handle("project:switch-branch", async ({ cwd, branch }) => {
    if (cwd !== project)
      throw new Error("The active project changed. Reopen the branch menu.");
    if (
      [...agent.sessions.values()].some(
        (item) => item.cwd === cwd && item.session.isStreaming,
      )
    )
      throw new Error("Stop the running agent before switching branches.");
    if (
      editorState.buffers.some(
        ([key, buffer]) =>
          key.startsWith(cwd + path.sep) && buffer.content !== buffer.original,
      )
    )
      throw new Error("Save or close unsaved files before switching branches.");
    return switchBranch(project, branch);
  });
  handle("project:open", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    if (result.canceled) return null;
    if (!result.canceled) {
      project = result.filePaths[0];
      if (!projects.includes(project)) projects.push(project);
      await persist();
    }
    return project;
  });
  handle("project:select", async ({ cwd }) => {
    if (!projects.includes(cwd)) {
      if (!conversations.some((item) => item.cwd === cwd))
        throw new Error("Unknown project");
      projects.push(cwd);
    }
    project = cwd;
    await persist();
    return { project, git: await gitInfo(project) };
  });
  handle("project:remove", async ({ cwd }) => {
    if (!projects.includes(cwd)) throw new Error("Unknown project");
    projects = projects.filter((item) => item !== cwd);
    if (project === cwd) project = projects[0] || process.cwd();
    if (!projects.includes(project)) projects.push(project);
    await persist();
    return { project, projects, git: await gitInfo(project) };
  });
  handle(
    "conversation:update",
    async ({ id, title, pinned, archived, read }) => {
      const item = conversations.find((c) => c.id === id);
      if (!item) throw new Error("Conversation not found");
      if (typeof title === "string" && title.trim())
        item.title = title.trim().slice(0, 150);
      if (typeof pinned === "boolean") item.pinned = pinned;
      if (typeof archived === "boolean") item.archived = archived;
      if (typeof read === "boolean") item.readAt = read ? Date.now() : 0;
      await persist();
      return item;
    },
  );
  handle("project:changes", () => changes(project));
  handle("project:search", ({ query }) => search(project, query));
  handle("files:create", ({ relative, directory }) =>
    createProjectEntry(project, relative, directory),
  );
  handle("files:rename", ({ relative, destination }) =>
    renameProjectEntry(project, relative, destination),
  );
  handle("files:reveal", async ({ relative }) =>
    shell.showItemInFolder(await resolveProjectPath(project, relative)),
  );
  handle("files:list", ({ relative }) => listFiles(project, relative));
  handle("files:read", ({ relative }) => readProjectFile(project, relative));
  handle("files:save", ({ relative, content, expectedContent }) =>
    saveProjectFile(project, relative, content, expectedContent),
  );
  handle("agent:create", async (args) => {
    let sessionFile;
    if (args.id) {
      const saved = conversations.find((c) => c.id === args.id);
      if (!saved) throw new Error("Conversation not found");
      if (agent.sessions.has(args.id)) {
        const live = agent.get(args.id);
        emit({
          type: "context_usage",
          sessionId: args.id,
          usage: live.session.getContextUsage(),
        });
        return {
          ...saved,
          messages: live.session.messages,
          mode: live.mode,
          modelId: live.session.model?.id,
          thinkingLevel: live.session.thinkingLevel,
          busy: live.session.isStreaming,
          question: agent.questions.pending(args.id)[0] ?? null,
          plan: await agent.plans.get(args.id),
          queued: [
            ...live.session.getSteeringMessages(),
            ...live.session.getFollowUpMessages(),
          ],
        };
      }
      sessionFile = saved.sessionFile;
    }
    const saved = args.id && conversations.find((c) => c.id === args.id);
    const result = await agent.create({
      cwd: saved?.cwd ?? project,
      modelId: saved?.modelId ?? args.modelId,
      mode: saved?.mode ?? args.mode,
      sessionFile,
    });
    emit({
      type: "context_usage",
      sessionId: result.id,
      usage: agent.get(result.id).session.getContextUsage(),
    });
    if (!saved) {
      conversations.unshift({
        ...result,
        messages: undefined,
        title: "New conversation",
        createdAt: Date.now(),
      });
      await persist();
    }
    return result;
  });
  handle("agent:prompt", ({ id, text, images = [] }) => {
    agent.validatePrompt(id, text, images);
    const item = conversations.find((c) => c.id === id);
    if (item) item.updatedAt = Date.now();
    if (item?.title === "New conversation") {
      item.title = text.slice(0, 70);
    }
    void persist();
    void agent
      .prompt(id, text, images)
      .catch((error) =>
        emit({ type: "error", sessionId: id, message: error.message }),
      );
    return true;
  });
  handle("agent:model", async ({ id, modelId, thinkingLevel }) => {
    const result = await agent.setModel(id, modelId, thinkingLevel);
    Object.assign(
      conversations.find((c) => c.id === id),
      result,
    );
    await persist();
    emit({ type: "session_settings", sessionId: id, ...result });
    return result;
  });
  handle("agent:fork", async ({ id, timestamp, before = false }) => {
    const result = await agent.fork(id, timestamp, before);
    const source = conversations.find((c) => c.id === id);
    conversations.unshift({
      ...result,
      messages: undefined,
      title:
        (source?.title || "Conversation") + (before ? " · Edited" : " · Fork"),
      createdAt: Date.now(),
    });
    await persist();
    return result;
  });
  handle("plan:get", ({ id }) => agent.plans.get(id));
  handle("plan:save", ({ id, plan }) => {
    agent.get(id);
    return agent.plans.save(id, plan);
  });
  handle("plan:build", async ({ id }) => {
    const plan = await agent.plans.get(id);
    if (!plan) throw new Error("No plan to build");
    agent.setMode(id, "agent");
    emit({ type: "session_settings", sessionId: id, mode: "agent" });
    const item = conversations.find((c) => c.id === id);
    item.mode = "agent";
    await persist();
    void agent
      .prompt(
        id,
        "Implement this approved plan. Update todos as you work.\n\n" +
          JSON.stringify(plan),
      )
      .catch((error) =>
        emit({ type: "error", sessionId: id, message: error.message }),
      );
    return true;
  });
  handle("agent:queue:clear", ({ id }) => {
    const queue = agent.get(id).session.clearQueue();
    return [...queue.steering, ...queue.followUp];
  });
  handle("agent:stop", async ({ id }) => {
    const item = conversations.find((conversation) => conversation.id === id);
    const turn = [...agent.get(id).session.messages]
      .reverse()
      .find((message) => message.role === "user");
    if (item && turn)
      item.stoppedTurns = [
        ...new Set([...(item.stoppedTurns || []), turn.timestamp]),
      ];
    const queued = await agent.stop(id);
    await persist();
    return queued;
  });
  handle("agent:mode", async ({ id, mode }) => {
    agent.setMode(id, mode);
    const item = conversations.find((c) => c.id === id);
    if (item) item.mode = mode;
    await persist();
    emit({ type: "session_settings", sessionId: id, mode });
  });
  handle("question:answer", ({ sessionId, id, answers }) => {
    agent.questions.answer(sessionId, id, answers);
    emit({ type: "question_answered", sessionId, id });
  });
  handle("auth:login", () => {
    if (loginController) throw new Error("Login is already in progress");
    loginController = new AbortController();
    void agent
      .login(loginController.signal)
      .then((models) => emit({ type: "auth_complete", models }))
      .catch((error) => emit({ type: "error", message: error.message }))
      .finally(() => {
        loginController = null;
      });
    return true;
  });
  handle("auth:logout", async () => {
    if ([...agent.sessions.values()].some((item) => item.session.isStreaming))
      throw new Error("Stop running responses before logging out.");
    loginController?.abort();
    await agent.runtime.logout("openai-codex");
    await agent.dispose();
    return true;
  });
  handle("auth:cancel", () => {
    loginController?.abort();
    agent.questions.cancel("auth");
  });
  handle("external:open", ({ url }) => shell.openExternal(validURL(url)));
  const embedded = new WorkspaceBrowser(
    win,
    emit,
    path.join(app.getPath("userData"), "browser-state.json"),
  );
  await embedded.restore();
  agent.browserAction = (args) => embedded.action(args);
  handle("browser:navigate", ({ url }) => embedded.navigate(url));
  let browserLayoutRevision = 0;
  handle("browser:bounds", async (args) => {
    const revision = ++browserLayoutRevision;
    if (!args.visible && embedded.visible && embedded.active) {
      try {
        const snapshot = await embedded.current().capturePage();
        if (revision !== browserLayoutRevision) return;
        emit({ type: "browser_snapshot", dataURL: snapshot.toDataURL() });
      } catch {}
    }
    if (revision === browserLayoutRevision) embedded.layout(args);
  });
  handle("browser:back", () => {
    const wc = embedded.current();
    if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  });
  handle("browser:forward", () => {
    const wc = embedded.current();
    if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  });
  handle("browser:reload", () => embedded.current().reload());
  handle("browser:inspect", () => embedded.inspect());
  handle("browser:logs", ({ clear = false }) => {
    if (clear) {
      embedded.consoleLogs.set(embedded.active, []);
      embedded.networkLogs.set(embedded.active, []);
    }
    return {
      console: embedded.consoleLogs.get(embedded.active) || [],
      network: embedded.networkLogs.get(embedded.active) || [],
    };
  });
  handle("browser:new", () => embedded.create());
  handle("browser:select", ({ id }) => embedded.select(id));
  handle("browser:close", ({ id }) => embedded.close(id));
  const terminals = new WorkspaceTerminal(emit);
  handle("terminal:open", () => terminals.open(project));
  handle("terminal:snapshot", ({ id }) => terminals.snapshot(id));
  handle("terminal:write", (args) => terminals.write(args));
  handle("terminal:resize", (args) => terminals.resize(args));
  handle("terminal:close", ({ id }) => terminals.close(id));
  await mainContents.loadFile(path.join(here, "../dist/index.html"));
  app.on("window-all-closed", () => {
    embedded.dispose();
    terminals.dispose();
    loginController?.abort();
    void agent.dispose();
    app.quit();
  });
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  start().catch((error) => {
    console.error(error);
    app.quit();
  });
}
