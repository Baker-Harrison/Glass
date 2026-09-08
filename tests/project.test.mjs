import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { changes, search } from "../desktop/project.mjs";
test("review includes renamed, modified and untracked files without losing paths with spaces", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "glass-review-"));
  const git = (...args) => execFileSync("git", args, { cwd, stdio: "pipe" });
  try {
    git("init");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Glass Test");
    await writeFile(path.join(cwd, "old name.txt"), "original\n");
    await writeFile(path.join(cwd, "edit.txt"), "before\n");
    git("add", ".");
    git("commit", "-m", "fixture");
    git("mv", "old name.txt", "new name.txt");
    await writeFile(path.join(cwd, "edit.txt"), "after\n");
    await writeFile(path.join(cwd, "untracked.txt"), "new content\n");
    const result = await changes(cwd);
    const rename = result.files.find((file) => file.path === "new name.txt");
    assert.equal(rename.originalPath, "old name.txt");
    const edit = result.files.find((file) => file.path === "edit.txt");
    assert.equal(edit.additions, 1);
    assert.equal(edit.deletions, 1);
    assert.match(edit.diff, /-before\n\+after/);
    const untracked = result.files.find(
      (file) => file.path === "untracked.txt",
    );
    assert.equal(untracked.additions, 1);
    assert.match(untracked.diff, /\+new content/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("search respects ignored files in folders without Git and returns source line numbers", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "glass-search-"));
  try {
    await mkdir(path.join(cwd, "node_modules"));
    await writeFile(path.join(cwd, ".gitignore"), "ignored.txt\n");
    await writeFile(path.join(cwd, "source.txt"), "first\nneedle text\n");
    await writeFile(path.join(cwd, "ignored.txt"), "needle text");
    await writeFile(
      path.join(cwd, "node_modules", "dependency.txt"),
      "needle text",
    );
    assert.deepEqual(await search(cwd, "needle"), [
      { path: "source.txt", line: 2, text: "needle text" },
    ]);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
