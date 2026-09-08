import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceTerminal } from "../desktop/terminal.mjs";
import { tmpdir } from "node:os";

test(
  "ended terminal snapshots retain output and exit status and tolerate resizing",
  { timeout: 10000 },
  async () => {
    let ended;
    const done = new Promise((resolve) => {
      ended = resolve;
    });
    const terminals = new WorkspaceTerminal((event) => {
      if (event.type === "terminal_exit") ended(event);
    });
    try {
      const { id } = terminals.open(tmpdir());
      terminals.write({ id, data: "printf 'terminal-fixture\\n'; exit 7\n" });
      const exit = await done;
      assert.equal(exit.code, 7);
      const saved = terminals.snapshot(id);
      assert.equal(saved.exitCode, 7);
      assert.equal(saved.exited, true);
      assert.match(saved.output, /terminal-fixture/);
      assert.doesNotThrow(() => terminals.resize({ id, cols: 100, rows: 30 }));
    } finally {
      terminals.dispose();
    }
  },
);
