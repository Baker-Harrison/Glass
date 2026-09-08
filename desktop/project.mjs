import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readProjectFile } from "./files.mjs";
const exec = promisify(execFile);
export async function gitInfo(cwd) {
  try {
    const { stdout } = await exec("git", ["branch", "--show-current"], { cwd });
    return { branch: stdout.trim() || "Detached HEAD", repository: true };
  } catch {
    return { branch: null, repository: false };
  }
}
export async function changes(cwd) {
  const info = await gitInfo(cwd);
  if (!info.repository) return { ...info, files: [], diff: "" };
  const { stdout: status } = await exec(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd, maxBuffer: 2e6 },
  );
  const hasHead = await exec("git", ["rev-parse", "--verify", "HEAD"], {
    cwd,
  }).then(
    () => true,
    () => false,
  );
  const parts = status.split("\0");
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const row = parts[i];
    if (!row) continue;
    const item = { status: row.slice(0, 2), path: row.slice(3) };
    if (/[RC]/.test(item.status)) item.originalPath = parts[++i];
    files.push(item);
  }
  await Promise.all(
    files.map(async (item) => {
      if (item.status === "??" || !hasHead) {
        try {
          const content = await readProjectFile(cwd, item.path);
          const lines = content.split("\n");
          if (lines.at(-1) === "") lines.pop();
          item.diff = [
            "--- /dev/null",
            "+++ b/" + item.path,
            "@@ -0,0 +1," + lines.length + " @@",
            ...lines.map((line) => "+" + line),
          ].join("\n");
        } catch (error) {
          item.notice = error.message;
          item.diff = "";
        }
      } else {
        try {
          const { stdout } = await exec(
            "git",
            [
              "diff",
              "HEAD",
              "--no-ext-diff",
              "--no-color",
              "--",
              ...(item.originalPath ? [item.originalPath] : []),
              item.path,
            ],
            { cwd, maxBuffer: 5e6 },
          );
          item.diff = stdout;
        } catch (error) {
          item.diff = "";
          item.notice = "The diff is too large to display.";
        }
      }
      const lines = item.diff.split("\n");
      item.additions = lines.filter(
        (line) => line.startsWith("+") && !line.startsWith("+++"),
      ).length;
      item.deletions = lines.filter(
        (line) => line.startsWith("-") && !line.startsWith("---"),
      ).length;
    }),
  );
  const diff = files.map((item) => item.diff).join("\n");
  return { ...info, files, diff };
}
export async function search(cwd, query) {
  if (typeof query !== "string" || query.length < 2) return [];
  try {
    const { stdout } = await exec(
      "rg",
      [
        "--json",
        "--fixed-strings",
        "--no-require-git",
        "--glob",
        "!node_modules/**",
        "--max-count",
        "20",
        "--glob",
        "!vendor/**",
        "--glob",
        "!dist/**",
        "--glob",
        "!package-lock.json",
        "--",
        query,
        ".",
      ],
      { cwd, maxBuffer: 3e6 },
    );
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((row) => row.type === "match")
      .slice(0, 150)
      .map((row) => ({
        path: row.data.path.text.replace(/^\.\//, ""),
        line: row.data.line_number,
        text: row.data.lines.text.trim(),
      }));
  } catch (error) {
    if (error.code === 1) return [];
    throw error;
  }
}
