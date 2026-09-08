import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { saveProjectFile } from "../desktop/files.mjs";
test("editor cannot overwrite an agent change made after the file was opened", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "glass-editor-"));
  try {
    const filename = path.join(dir, "fixture.txt");
    await writeFile(filename, "agent edit");
    await assert.rejects(
      saveProjectFile(dir, "fixture.txt", "unsaved draft", "original"),
      /changed on disk/,
    );
    assert.equal(await readFile(filename, "utf8"), "agent edit");
    await saveProjectFile(dir, "fixture.txt", "reviewed edit", "agent edit");
    assert.equal(await readFile(filename, "utf8"), "reviewed edit");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file creation and rename stay inside the project and preserve existing files", async () => {
  const { createProjectEntry, renameProjectEntry } =
    await import("../desktop/files.mjs");
  const dir = await mkdtemp(path.join(os.tmpdir(), "glass-file-actions-"));
  try {
    await createProjectEntry(dir, "notes", true);
    await createProjectEntry(dir, "notes/first.md");
    await writeFile(path.join(dir, "notes/first.md"), "keep content");
    await assert.rejects(
      createProjectEntry(dir, "notes/first.md"),
      /already exists/,
    );
    await assert.rejects(createProjectEntry(dir, "../escaped.md"), /outside/);
    await renameProjectEntry(dir, "notes/first.md", "notes/renamed.md");
    assert.equal(
      await readFile(path.join(dir, "notes/renamed.md"), "utf8"),
      "keep content",
    );
    await assert.rejects(
      renameProjectEntry(dir, ".", "elsewhere"),
      /project folder/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
