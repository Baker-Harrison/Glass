import test from "node:test";
import assert from "node:assert/strict";
import { MessageTimings } from "../desktop/message-timings.mjs";

test("thinking duration tracks its own streamed interval and survives reopening", () => {
  const clock = new MessageTimings();
  const message = {
    role: "assistant",
    timestamp: 50,
    content: [{ type: "thinking", thinking: "A short summary" }],
  };
  clock.track({ type: "message_start", message }, 1000);
  clock.track(
    {
      type: "message_update",
      message,
      assistantMessageEvent: { type: "thinking_start", contentIndex: 0 },
    },
    1100,
  );
  const delta = clock.track(
    {
      type: "message_update",
      message,
      assistantMessageEvent: { type: "thinking_delta", contentIndex: 0 },
    },
    1600,
  );
  clock.track(
    {
      type: "message_update",
      message,
      assistantMessageEvent: { type: "thinking_end", contentIndex: 0 },
    },
    2400,
  );
  const end = clock.track({ type: "message_end", message }, 5000);
  assert.deepEqual(end.message.glassTiming.thinking[0], {
    startedAt: 1100,
    endedAt: 2400,
  });
  assert.equal(end.message.glassTiming.endedAt, 5000);
  assert.equal(message.glassTiming, undefined);
  assert.equal(delta.message.glassTiming.thinking[0].endedAt, undefined);
  const restored = new MessageTimings([
    JSON.parse(JSON.stringify(end.message.glassTiming)),
  ]);
  assert.deepEqual(restored.decorate(message), end.message);
});

test("interrupted thinking closes at message end and historical messages remain unestimated", () => {
  const timings = new MessageTimings();
  const message = { role: "assistant", timestamp: 10, content: [] };
  assert.equal(timings.decorate(message), message);
  timings.track(
    {
      type: "message_update",
      message,
      assistantMessageEvent: { type: "thinking_delta", contentIndex: 1 },
    },
    100,
  );
  const event = timings.track(
    { type: "message_end", message: { ...message, stopReason: "aborted" } },
    700,
  );
  assert.deepEqual(event.message.glassTiming.thinking[1], {
    startedAt: 100,
    endedAt: 700,
  });
});
