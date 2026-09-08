import test from "node:test";
import assert from "node:assert/strict";
import { Questions } from "../desktop/questions.mjs";

test("questions wait for an answer and cannot be answered by a different session", async () => {
  const events = [];
  const questions = new Questions((event) => events.push(event));
  const result = questions.ask("session-a", [{ title: "Choose a path" }]);
  assert.throws(() => questions.answer("session-b", events[0].id, ["One"]));
  questions.answer("session-a", events[0].id, ["One"]);
  assert.deepEqual(await result, ["One"]);
  assert.throws(() => questions.answer("session-a", events[0].id, ["Two"]));
});

test("abort releases a waiting question", async () => {
  const events = [];
  const questions = new Questions((event) => events.push(event));
  const controller = new AbortController();
  const result = questions.ask("session-a", [], controller.signal);
  controller.abort();
  await assert.rejects(result, /cancelled/);
  assert.equal(events[1].type, "question_cancelled");
});

test("pending questions survive navigation and reject incomplete answer sets", async () => {
  const events = [];
  const questions = new Questions((e) => events.push(e));
  const result = questions.ask("a", [{ title: "One" }, { title: "Two" }]);
  assert.equal(questions.pending("a").length, 1);
  assert.equal(questions.pending("b").length, 0);
  assert.throws(() => questions.answer("a", events[0].id, ["only one"]));
  assert.throws(() => questions.answer("a", events[0].id, ["one", ""]));
  questions.answer("a", events[0].id, ["one", "two"]);
  assert.deepEqual(await result, ["one", "two"]);
  assert.equal(questions.pending("a").length, 0);
});
