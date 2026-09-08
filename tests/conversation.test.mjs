import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMessageEvent,
  groupTurns,
  turnContent,
} from "../src/conversation-model.mjs";
test("stream updates preserve intervening tool results", () => {
  const assistant = {
    role: "assistant",
    timestamp: 10,
    content: [{ type: "text", text: "Hel" }],
  };
  const tool = {
    role: "toolResult",
    toolCallId: "t1",
    timestamp: 11,
    content: [],
  };
  let messages = applyMessageEvent([], {
    type: "message_start",
    message: assistant,
  });
  messages = applyMessageEvent(messages, {
    type: "message_start",
    message: tool,
  });
  messages = applyMessageEvent(messages, {
    type: "message_update",
    message: { ...assistant, content: [{ type: "text", text: "Hello" }] },
  });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].content[0].text, "Hello");
  assert.equal(messages[1].toolCallId, "t1");
});
test("conversation groups tool execution with its initiating user turn", () => {
  const turns = groupTurns([
    { role: "user", timestamp: 1 },
    { role: "assistant", timestamp: 2 },
    { role: "toolResult", timestamp: 3 },
    { role: "user", timestamp: 4 },
  ]);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].messages.length, 2);
  assert.equal(turns[1].messages.length, 0);
});

test("tool progress stays in chronological work history with only the final answer outside", () => {
  const commentary = {
    role: "assistant",
    content: [
      { type: "text", text: "Checking" },
      { type: "toolCall", id: "read-1", name: "read" },
    ],
  };
  const result = {
    role: "toolResult",
    toolCallId: "read-1",
    content: [{ type: "text", text: "file content" }],
  };
  const final = {
    role: "assistant",
    content: [{ type: "text", text: "Done" }],
  };
  const before = turnContent([commentary, result]);
  assert.equal(before.final, null);
  assert.deepEqual(
    before.work.map((part) => part.type),
    ["text", "toolCall"],
  );
  const after = turnContent([commentary, result, final]);
  assert.equal(after.final, final);
  assert.deepEqual(after.work, before.work);
});
