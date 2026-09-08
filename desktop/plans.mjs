import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
export class Plans {
  constructor(directory, emit) {
    this.directory = directory;
    this.emit = emit;
    this.writes = new Map();
  }
  location(id) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Invalid session");
    return path.join(this.directory, id + ".json");
  }
  async get(id) {
    try {
      return JSON.parse(await readFile(this.location(id), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  async save(id, plan) {
    if (
      typeof plan.title !== "string" ||
      typeof plan.content !== "string" ||
      !Array.isArray(plan.todos)
    )
      throw new Error("Invalid plan");
    const record = {
      title: plan.title,
      summary: plan.summary || "",
      content: plan.content,
      todos: plan.todos.map((todo, index) => ({
        id: todo.id || String(index + 1),
        text: todo.text,
        status: ["pending", "in_progress", "completed"].includes(todo.status)
          ? todo.status
          : "pending",
      })),
      updatedAt: Date.now(),
    };
    if (record.todos.some((t) => typeof t.text !== "string"))
      throw new Error("Invalid todo");
    const previous = this.writes.get(id) || Promise.resolve();
    const saving = previous
      .catch(() => {})
      .then(async () => {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const existed = await this.get(id);
        const location = this.location(id);
        await writeFile(location + ".tmp", JSON.stringify(record), {
          mode: 0o600,
        });
        await rename(location + ".tmp", location);
        this.emit({
          type: "plan",
          sessionId: id,
          plan: record,
          created: !existed || existed.title !== record.title,
        });
        return record;
      });
    this.writes.set(id, saving);
    return saving;
  }
}
