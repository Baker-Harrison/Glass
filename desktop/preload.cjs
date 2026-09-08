const { contextBridge, ipcRenderer } = require("electron");
const channels = new Set([
  "state",
  "app:restart",
  "editor:save-state",
  "plan:get",
  "plan:save",
  "plan:build",
  "project:open",
  "project:select",
  "project:branches",
  "project:switch-branch",
  "project:remove",
  "conversation:update",
  "project:changes",
  "project:search",
  "files:list",
  "files:create",
  "files:rename",
  "files:reveal",
  "files:read",
  "files:save",
  "agent:create",
  "agent:prompt",
  "agent:stop",
  "agent:queue:clear",
  "agent:fork",
  "agent:model",
  "agent:mode",
  "question:answer",
  "auth:login",
  "auth:logout",
  "auth:cancel",
  "external:open",
  "browser:navigate",
  "browser:bounds",
  "browser:back",
  "browser:forward",
  "browser:reload",
  "browser:inspect",
  "browser:logs",
  "browser:new",
  "browser:select",
  "browser:close",
  "terminal:open",
  "terminal:snapshot",
  "terminal:write",
  "terminal:resize",
  "terminal:close",
]);
contextBridge.exposeInMainWorld("glass", {
  invoke: (channel, args) => {
    if (!channels.has(channel)) throw new Error("Unknown operation");
    return ipcRenderer.invoke(channel, args);
  },
  subscribe: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("glass:event", handler);
    return () => ipcRenderer.removeListener("glass:event", handler);
  },
});
