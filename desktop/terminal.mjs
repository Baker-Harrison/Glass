import pty from "node-pty";
export class WorkspaceTerminal {
  sessions = new Map();
  constructor(emit) {
    this.emit = emit;
  }
  state() {
    return [...this.sessions].map(([id, entry]) => ({
      id,
      cwd: entry.cwd,
      exited: !!entry.exited,
      exitCode: entry.exitCode,
    }));
  }
  open(cwd) {
    const id = crypto.randomUUID();
    const terminal = pty.spawn(process.env.SHELL || "/bin/zsh", ["-l"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, TERM: "xterm-256color" },
    });
    const entry = { terminal, output: "", sequence: 0, cwd };
    this.sessions.set(id, entry);
    terminal.onData((data) => {
      entry.output = (entry.output + data).slice(-500000);
      this.emit({
        type: "terminal_data",
        id,
        data,
        sequence: ++entry.sequence,
      });
    });
    terminal.onExit(({ exitCode }) => {
      entry.exited = true;
      entry.exitCode = exitCode;
      this.emit({ type: "terminal_sessions", sessions: this.state() });
      this.emit({ type: "terminal_exit", id, code: exitCode });
    });
    this.emit({ type: "terminal_sessions", sessions: this.state() });
    return { id, output: entry.output, sequence: entry.sequence };
  }
  snapshot(id) {
    const entry = this.sessions.get(id);
    if (!entry) throw new Error("Terminal not found");
    return {
      id,
      output: entry.output,
      sequence: entry.sequence,
      exited: entry.exited,
      exitCode: entry.exitCode,
    };
  }
  write({ id, data }) {
    const entry = this.sessions.get(id);
    if (!entry || entry.exited) throw new Error("Terminal has exited");
    entry.terminal.write(data);
  }
  resize({ id, cols, rows }) {
    const entry = this.sessions.get(id);
    if (!entry || entry.exited) return;
    try {
      entry.terminal.resize(
        Math.max(2, Math.min(500, cols)),
        Math.max(1, Math.min(250, rows)),
      );
    } catch (error) {
      if (!entry.exited && error.code !== "EBADF") throw error;
    }
  }
  close(id) {
    this.sessions.get(id)?.terminal.kill();
    this.sessions.delete(id);
    this.emit({ type: "terminal_sessions", sessions: this.state() });
  }
  dispose() {
    for (const id of this.sessions.keys()) this.close(id);
  }
}
