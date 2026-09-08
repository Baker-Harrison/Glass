import { randomUUID } from "node:crypto";

export class Questions {
  #pending = new Map();
  constructor(emit) {
    this.emit = emit;
  }
  ask(sessionId, questions, signal) {
    if (signal?.aborted) return Promise.reject(new Error("Question cancelled"));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.#pending.delete(id);
        signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        this.emit({ type: "question_cancelled", sessionId, id });
        reject(new Error("Question cancelled"));
      };
      this.#pending.set(id, {
        sessionId,
        questions,
        id,
        resolve: (answers) => {
          cleanup();
          resolve(answers);
        },
        abort,
      });
      signal?.addEventListener("abort", abort, { once: true });
      this.emit({ type: "question", sessionId, id, questions });
    });
  }
  answer(sessionId, id, answers) {
    const pending = this.#pending.get(id);
    if (!pending || pending.sessionId !== sessionId)
      throw new Error("This question is no longer awaiting an answer");
    if (
      !Array.isArray(answers) ||
      answers.length !== pending.questions.length ||
      answers.some((answer) => typeof answer !== "string" || !answer.trim())
    )
      throw new Error("Invalid answers");
    pending.resolve(answers);
  }
  pending(sessionId) {
    return [...this.#pending.values()]
      .filter((p) => p.sessionId === sessionId)
      .map(({ id, questions }) => ({
        type: "question",
        sessionId,
        id,
        questions,
      }));
  }
  cancel(sessionId) {
    for (const pending of this.#pending.values())
      if (pending.sessionId === sessionId) pending.abort();
  }
}
