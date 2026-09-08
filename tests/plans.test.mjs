import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Plans } from "../desktop/plans.mjs";
test("plan writes serialize and survive reopening without touching project files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "glass-plans-"));
  try {
    const events = [];
    const plans = new Plans(directory, (event) => events.push(event));
    const plan = {
      title: "Reset greeting",
      content: "Add a reset button.",
      todos: [{ id: "reset", text: "Reset", status: "pending" }],
    };
    await Promise.all([
      plans.save("test-session", plan),
      plans.save("test-session", {
        ...plan,
        content: "Clear the greeting.",
        todos: [{ ...plan.todos[0], status: "completed" }],
      }),
    ]);
    const saved = await new Plans(directory, () => {}).get("test-session");
    assert.equal(saved.content, "Clear the greeting.");
    assert.equal(saved.todos[0].status, "completed");
    assert.deepEqual(await readdir(directory), ["test-session.json"]);
    assert.deepEqual(
      events.map((event) => event.created),
      [true, false],
    );
    await assert.rejects(plans.save("../outside", plan), /Invalid session/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
