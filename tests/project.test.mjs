import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  changes,
  search,
  branches,
  switchBranch,
} from "../desktop/project.mjs";
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

test("branch switching updates the checkout and preserves conflicting edits", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "glass-branches-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();
  try {
    git("init", "-b", "main");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Glass Test");
    await writeFile(path.join(cwd, "example.txt"), "main content\n");
    git("add", ".");
    git("commit", "-m", "main");
    git("switch", "-c", "feature/example");
    await writeFile(path.join(cwd, "example.txt"), "feature content\n");
    git("commit", "-am", "feature");
    git("switch", "main");
    assert.deepEqual((await branches(cwd)).branches, [
      "feature/example",
      "main",
    ]);
    assert.equal(
      (await switchBranch(cwd, "feature/example")).branch,
      "feature/example",
    );
    assert.equal(git("branch", "--show-current"), "feature/example");
    assert.equal(
      await readFile(path.join(cwd, "example.txt"), "utf8"),
      "feature content\n",
    );
    await writeFile(path.join(cwd, "example.txt"), "unsaved work\n");
    await assert.rejects(switchBranch(cwd, "main"), /overwritten/);
    assert.equal(git("branch", "--show-current"), "feature/example");
    assert.equal(
      await readFile(path.join(cwd, "example.txt"), "utf8"),
      "unsaved work\n",
    );
    await assert.rejects(
      switchBranch(cwd, "--discard-changes"),
      /existing local branch/,
    );
    await assert.rejects(switchBranch(cwd, "missing"), /existing local branch/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
