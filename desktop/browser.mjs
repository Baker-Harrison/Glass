import { WebContentsView } from "electron";
import { designSelectionScript } from "./design-script.mjs";
import { readFile, writeFile, rename } from "node:fs/promises";
export function validURL(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Use an HTTP or HTTPS address");
  return url.href;
}
export class WorkspaceBrowser {
  tabs = new Map();
  requestedURLs = new Map();
  consoleLogs = new Map();
  networkLogs = new Map();
  designTabs = new Set();
  active = null;
  bounds = null;
  visible = false;
  constructor(win, emit, stateFile) {
    this.win = win;
    this.emit = emit;
    this.stateFile = stateFile;
    this.pendingWrite = Promise.resolve();
    this.restoring = false;
  }
  state() {
    return [...this.tabs].map(([id, view]) => ({
      id,
      title: view.webContents.getTitle() || "New tab",
      url: view.webContents.getURL() || this.requestedURLs.get(id) || "",
      canGoBack: view.webContents.navigationHistory.canGoBack(),
      canGoForward: view.webContents.navigationHistory.canGoForward(),
      loading: view.webContents.isLoading(),
      designActive: this.designTabs.has(id),
    }));
  }
  publish() {
    this.emit({
      type: "browser_tabs",
      tabs: this.state(),
      active: this.active,
    });
    if (this.stateFile && !this.restoring) {
      const tabs = this.state();
      const saved = JSON.stringify({
        urls: tabs.map((tab) => tab.url),
        active: tabs.findIndex((tab) => tab.id === this.active),
      });
      this.pendingWrite = this.pendingWrite
        .catch(() => {})
        .then(async () => {
          await writeFile(this.stateFile + ".tmp", saved, { mode: 0o600 });
          await rename(this.stateFile + ".tmp", this.stateFile);
        })
        .catch((error) =>
          console.error("Browser state could not be saved:", error.message),
        );
    }
  }
  async restore() {
    if (!this.stateFile) return;
    this.restoring = true;
    try {
      const saved = JSON.parse(await readFile(this.stateFile, "utf8"));
      const ids = [];
      for (const url of saved.urls.slice(0, 30)) {
        const id = this.create();
        ids.push(id);
        if (url && url !== "about:blank") {
          try {
            this.requestedURLs.set(id, validURL(url));
            void this.tabs
              .get(id)
              .webContents.loadURL(validURL(url))
              .catch(() => {});
          } catch {}
        }
      }
      if (ids.length) this.select(ids[saved.active] || ids[0]);
    } catch (error) {
      if (error.code !== "ENOENT")
        console.error("Browser state could not be restored:", error.message);
    } finally {
      this.restoring = false;
    }
  }
  dispose() {
    for (const view of this.tabs.values())
      if (!view.webContents.isDestroyed()) view.webContents.close();
    this.tabs.clear();
  }
  create() {
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        partition: "persist:glass-browser",
      },
    });
    const id = String(view.webContents.id);
    this.tabs.set(id, view);
    this.consoleLogs.set(id, []);
    this.networkLogs.set(id, []);
    view.webContents.session.webRequest.onCompleted((details) => {
      const records = this.networkLogs.get(String(details.webContentsId));
      if (records) {
        records.push({
          url: details.url,
          method: details.method,
          status: details.statusCode,
          resourceType: details.resourceType,
          time: Date.now(),
        });
        if (records.length > 200) records.shift();
        this.emit({
          type: "browser_network",
          tabId: String(details.webContentsId),
          entry: records.at(-1),
        });
      }
    });
    this.win.contentView.addChildView(view);

    view.webContents.session.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    view.webContents.setWindowOpenHandler(({ url }) => {
      try {
        validURL(url);
        this.create();
        void this.navigate(url);
      } catch {}
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (event, url) => {
      try {
        validURL(url);
      } catch {
        event.preventDefault();
      }
    });
    for (const name of [
      "did-navigate",
      "did-navigate-in-page",
      "page-title-updated",
      "did-finish-load",
    ])
      view.webContents.on(name, () => {
        this.layout();
        this.publish();
        if (this.active === id)
          this.emit({ type: "browser_url", url: view.webContents.getURL() });
      });
    view.webContents.on(
      "did-fail-load",
      (_event, code, description, _url, isMainFrame) => {
        if (code !== -3 && isMainFrame)
          this.emit({ type: "browser_error", message: description });
      },
    );
    view.webContents.on(
      "did-start-navigation",
      (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace && this.designTabs.delete(id))
          this.publish();
      },
    );
    view.webContents.on("console-message", async ({ message, level }) => {
      if (
        message === "__GLASS_DESIGN_ON__" ||
        message === "__GLASS_DESIGN_OFF__"
      ) {
        if (message === "__GLASS_DESIGN_ON__") this.designTabs.add(id);
        else this.designTabs.delete(id);
        this.publish();
        return;
      }
      if (!message.startsWith("__GLASS_SELECTION__")) {
        const records = this.consoleLogs.get(id);
        if (records) {
          records.push({
            level,
            message: message.slice(0, 5000),
            time: Date.now(),
          });
          if (records.length > 200) records.shift();
          this.emit({
            type: "browser_console",
            tabId: id,
            entry: records.at(-1),
          });
        }
        return;
      }
      try {
        const selection = JSON.parse(message.slice(19));
        const screenshot = await view.webContents.capturePage();
        this.emit({
          type: "browser_selection",
          selection: {
            ...selection,
            url: view.webContents.getURL(),
            image: {
              type: "image",
              mimeType: "image/png",
              data: screenshot.toPNG().toString("base64"),
            },
          },
        });
      } catch {}
    });
    this.select(id);
    return id;
  }
  select(id) {
    if (!this.tabs.has(id)) throw new Error("Browser tab not found");
    this.active = id;
    this.layout();
    this.publish();
  }
  current() {
    if (!this.active) this.create();
    return this.tabs.get(this.active).webContents;
  }
  close(id) {
    this.designTabs.delete(id);
    const view = this.tabs.get(id);
    if (!view) return;
    this.win.contentView.removeChildView(view);
    view.webContents.close();
    this.tabs.delete(id);
    this.requestedURLs.delete(id);
    this.consoleLogs.delete(id);
    this.networkLogs.delete(id);
    if (this.active === id) this.active = this.tabs.keys().next().value ?? null;
    this.layout();
    this.publish();
  }
  layout(args) {
    if (args) {
      this.visible = args.visible;
      if (args.bounds) this.bounds = args.bounds;
    }
    for (const [id, view] of this.tabs) {
      if (this.bounds)
        view.setBounds(
          Object.fromEntries(
            Object.entries(this.bounds).map(([k, v]) => [
              k,
              Math.max(k === "width" || k === "height" ? 1 : 0, Math.round(v)),
            ]),
          ),
        );
      const show =
        this.visible &&
        id === this.active &&
        !!view.webContents.getURL() &&
        view.webContents.getURL() !== "about:blank";
      if (view.getVisible() !== show) view.setVisible(show);
      if (process.env.GLASS_DEBUG)
        console.log("browser layout", {
          visible: view.getVisible(),
          bounds: view.getBounds(),
        });
    }
  }
  async navigate(url) {
    const current = this.current();
    this.requestedURLs.set(this.active, validURL(url));
    await current.loadURL(validURL(url));
    this.layout();
    this.current().focus();
    this.publish();
  }
  async inspect() {
    const page = this.current();
    page.focus();
    await page.executeJavaScript(`(${designSelectionScript.toString()})()`);
  }
  async action({ action, url, selector, text, key, direction, tabId }) {
    const result = (value) => ({
      content: [
        {
          type: "text",
          text: typeof value === "string" ? value : JSON.stringify(value),
        },
      ],
      details: {},
    });
    if (action === "tabs")
      return result({ tabs: this.state(), active: this.active });
    if (action === "select_tab") {
      this.select(tabId);
      return result("Selected tab " + tabId);
    }
    if (action === "console")
      return result(this.consoleLogs.get(this.active) || []);
    if (action === "network")
      return result(this.networkLogs.get(this.active) || []);
    if (action === "navigate") {
      await this.navigate(url);
      return {
        content: [{ type: "text", text: "Opened " + url }],
        details: {},
      };
    }
    const wc = this.current();
    if (action === "back" || action === "forward") {
      const navigation = wc.navigationHistory;
      if (action === "back" && navigation.canGoBack()) navigation.goBack();
      if (action === "forward" && navigation.canGoForward())
        navigation.goForward();
      return result("Navigation requested");
    }
    if (action === "reload") {
      await wc.loadURL(wc.getURL());
      return result("Page reloaded");
    }
    if (action === "scroll") {
      await wc.executeJavaScript(
        `window.scrollBy({top:${direction === "up" ? -1 : 1} * window.innerHeight * .8,behavior:'instant'})`,
      );
      return result("Page scrolled " + (direction || "down"));
    }
    if (action === "hover") {
      const point = await wc.executeJavaScript(
        `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Element not found');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
      );
      wc.sendInputEvent({ type: "mouseMove", ...point });
      return result("Hovered " + selector);
    }
    if (action === "press") {
      if (typeof key !== "string" || !key || key.length > 30)
        throw new Error("Provide a key such as Enter, Tab, or Escape");
      wc.sendInputEvent({ type: "keyDown", keyCode: key });
      wc.sendInputEvent({ type: "keyUp", keyCode: key });
      return result("Pressed " + key);
    }
    if (action === "screenshot") {
      const img = await wc.capturePage();
      return {
        content: [
          {
            type: "image",
            data: img.toPNG().toString("base64"),
            mimeType: "image/png",
          },
        ],
        details: {},
      };
    }
    if (action === "read") {
      const result = await wc.executeJavaScript(
        `JSON.stringify({title:document.title,url:location.href,text:document.body.innerText.slice(0,24000),elements:[...document.querySelectorAll('a,button,input,textarea,select')].slice(0,100).map(e=>({tag:e.tagName,text:e.innerText?.slice(0,100),id:e.id,type:e.type,placeholder:e.placeholder,href:e.href}))})`,
      );
      return { content: [{ type: "text", text: result }], details: {} };
    }
    if (!["click", "fill"].includes(action))
      throw new Error("Unknown browser action");
    await wc.executeJavaScript(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Element not found');${action === "click" ? "el.click();" : `const setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(el,${JSON.stringify(text ?? "")});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));`}})()`,
    );
    return {
      content: [{ type: "text", text: action + " completed" }],
      details: {},
    };
  }
}
