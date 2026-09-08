import test from "node:test";
import assert from "node:assert/strict";
import { contextUsage } from "../desktop/context-usage.mjs";
function session(tokens = 23100) {
  return {
    getContextUsage: () => ({
      tokens,
      contextWindow: 256000,
      percent: tokens == null ? null : tokens / 2560,
    }),
    systemPrompt: "s".repeat(4000),
    getActiveToolNames: () => ["read"],
    getAllTools: () => [
      { name: "read", description: "Read file", parameters: {} },
      { name: "write", description: "x".repeat(10000), parameters: {} },
    ],
    messages: [
      { role: "assistant", stopReason: "stop", usage: { totalTokens: 20000 } },
    ],
  };
}
test("preserves Pi totals and only estimates active tools, without exposing prompt text", () => {
  const result = contextUsage(session());
  assert.equal(result.tokens, 23100);
  assert.equal(result.contextWindow, 256000);
  assert.equal(result.breakdown[0].tokens, 1000);
  assert.ok(result.breakdown[1].tokens < 100);
  assert.equal(
    result.breakdown.reduce((sum, row) => sum + row.tokens, 0),
    result.tokens,
  );
  assert.equal(JSON.stringify(result).includes("Read file"), false);
});
test("unknown after compaction remains unknown, not zero", () => {
  const result = contextUsage(session(null));
  assert.equal(result.tokens, null);
  assert.equal(result.percent, null);
  assert.ok(result.breakdown.every((row) => row.tokens === null));
});
test("does not invent an allocation for partial totals or a fresh conversation", () => {
  assert.ok(
    contextUsage(session(12)).breakdown.every((row) => row.tokens === null),
  );
  const fresh = session();
  fresh.messages = [];
  assert.ok(contextUsage(fresh).breakdown.every((row) => row.tokens === null));
});
test("reflects changed context window, tools, and usage on the next snapshot", () => {
  const current = session();
  const before = contextUsage(current);
  current.getActiveToolNames = () => ["read", "write"];
  current.getContextUsage = () => ({
    tokens: 30000,
    contextWindow: 128000,
    percent: 23.4375,
  });
  const after = contextUsage(current);
  assert.equal(after.contextWindow, 128000);
  assert.equal(after.tokens, 30000);
  assert.ok(after.breakdown[1].tokens > before.breakdown[1].tokens);
});
test("missing model leaves usage unavailable", () => {
  const current = session();
  current.getContextUsage = () => undefined;
  assert.equal(contextUsage(current), undefined);
});

test("uses the reference categories and marks absent capabilities N/A", () => {
  const result = contextUsage(session());
  assert.deepEqual(
    result.breakdown.map((row) => row.label),
    [
      "System prompt",
      "Tool definitions",
      "Rules",
      "Skills",
      "MCP & dynamic tools",
      "Subagent definitions",
      "Conversation",
    ],
  );
  assert.deepEqual(
    result.breakdown
      .filter((row) => row.applicable === false)
      .map((row) => row.id),
    ["rules", "skills", "dynamic", "subagents"],
  );
});
test("streaming uses Pi message estimation without double counting completed output", () => {
  const current = session();
  current.state = {
    streamingMessage: {
      role: "assistant",
      content: [{ type: "text", text: "x".repeat(400) }],
    },
  };
  assert.equal(contextUsage(current).tokens, 23200);
  current.state.streamingMessage.content[0].text += "x".repeat(400);
  assert.equal(contextUsage(current).tokens, 23300);
  current.state.streamingMessage = undefined;
  current.getContextUsage = () => ({
    tokens: 23250,
    contextWindow: 256000,
    percent: 9.082,
  });
  assert.equal(contextUsage(current).tokens, 23250);
});
test("separates loaded rules from the system prompt without exposing contents", () => {
  const current = session();
  current.resourceLoader = {
    getAgentsFiles: () => ({
      agentsFiles: [{ content: "s".repeat(400) }, { content: "not injected" }],
    }),
  };
  const result = contextUsage(current);
  assert.equal(result.breakdown[0].tokens, 900);
  assert.equal(result.breakdown[2].tokens, 100);
  assert.equal(result.breakdown[2].applicable, true);
  assert.equal(
    result.breakdown.reduce((sum, row) => sum + row.tokens, 0),
    result.tokens,
  );
});
