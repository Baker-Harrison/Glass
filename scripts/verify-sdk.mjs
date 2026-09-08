import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { AgentWorkspace } from "../desktop/agent.mjs";
const dataDir = await mkdtemp(
  path.join(os.tmpdir(), "glass-sdk-verification-"),
);
const agent = new AgentWorkspace(dataDir, () => {});
await agent.initialize();
agent.runtime = await ModelRuntime.create({
  authPath: path.join(
    os.homedir(),
    "Library/Application Support/glass-agent/agent/auth.json",
  ),
  modelsPath: null,
});
const created = await agent.create({ cwd: process.cwd(), mode: "plan" });
const session = agent.get(created.id).session;
assert.deepEqual(session.getActiveToolNames().sort(), [
  "ask_question",
  "browser",
  "create_plan",
  "find",
  "grep",
  "ls",
  "read",
]);
agent.setMode(created.id, "agent");
for (const tool of ["bash", "edit", "write", "browser", "ask_question"])
  assert.ok(session.getActiveToolNames().includes(tool));
agent.setMode(created.id, "ask");
assert.ok(!session.getActiveToolNames().includes("write"));
assert.ok(session.getActiveToolNames().includes("browser"));
await agent.setModel(created.id, "gpt-5.4", "high");
assert.equal(session.model.id, "gpt-5.4");
assert.equal(session.thinkingLevel, "high");
const source = agent.get(created.id).manager;
source.appendMessage({
  role: "user",
  content: "Fork verification",
  timestamp: 1,
});
source.appendMessage({
  role: "assistant",
  content: [{ type: "text", text: "Ready" }],
  api: "openai-codex-responses",
  provider: "openai-codex",
  model: "gpt-5.4",
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 2,
});
const originalFile = source.getSessionFile();
const forked = await agent.fork(created.id, 2);
assert.notEqual(forked.id, created.id);
assert.equal(source.getSessionFile(), originalFile);
assert.equal(source.getSessionId(), created.id);
assert.notEqual(agent.get(forked.id).manager.getSessionFile(), originalFile);
const edited = await agent.fork(created.id, 1, true);
assert.equal(agent.get(edited.id).session.messages.length, 0);
assert.equal(source.getSessionFile(), originalFile);
assert.equal(source.getSessionId(), created.id);
await session.followUp("Keep this queued draft");
const recovered = await agent.stop(created.id);
assert.deepEqual(recovered, ["Keep this queued draft"]);
assert.equal(session.pendingMessageCount, 0);
await agent.dispose();
console.log(
  "SDK verified: Pi initialization, mode tools, model/reasoning changes, isolated fork, and stopped queue recovery.",
);
