import path from "node:path";
import {
  realpath,
  readdir,
  readFile,
  writeFile,
  stat,
  mkdir,
  rename,
  lstat,
} from "node:fs/promises";
export async function resolveProjectPath(root, relative = ".") {
  const base = await realpath(root);
  const target = await realpath(path.resolve(base, relative));
  if (target !== base && !target.startsWith(base + path.sep))
    throw new Error("File is outside the selected project");
  return target;
}
export async function listFiles(root, relative = ".") {
  const target = await resolveProjectPath(root, relative);
  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((e) => ![".git", "node_modules", ".DS_Store"].includes(e.name))
    .map((e) => ({
      name: e.name,
      path: path.join(relative, e.name),
      directory: e.isDirectory(),
    }))
    .sort(
      (a, b) =>
        Number(b.directory) - Number(a.directory) ||
        a.name.localeCompare(b.name),
    );
}
export async function readProjectFile(root, relative) {
  const target = await resolveProjectPath(root, relative);
  if ((await stat(target)).size > 2_000_000)
    throw new Error("This file is too large for the editor");
  const bytes = await readFile(target);
  if (bytes.includes(0))
    throw new Error("Binary files cannot be opened in the text editor");
  return bytes.toString("utf8");
}
export async function saveProjectFile(
  root,
  relative,
  content,
  expectedContent,
) {
  const target = await resolveProjectPath(root, relative);
  if (typeof content !== "string") throw new Error("Invalid file content");
  if (
    typeof expectedContent === "string" &&
    (await readFile(target, "utf8")) !== expectedContent
  )
    throw new Error(
      "This file changed on disk. Review the current file before saving your changes.",
    );
  await writeFile(target, content, "utf8");
}

async function newEntryPath(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative.trim() ||
    [".", ".."].includes(path.basename(relative))
  )
    throw new Error("Enter a file name");
  const parent = await resolveProjectPath(root, path.dirname(relative));
  const target = path.join(parent, path.basename(relative));
  try {
    await lstat(target);
    throw new Error("A file with this name already exists");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return target;
}
export async function createProjectEntry(root, relative, directory = false) {
  const target = await newEntryPath(root, relative);
  if (directory) await mkdir(target);
  else await writeFile(target, "", { flag: "wx" });
  return { path: relative, name: path.basename(relative), directory };
}
export async function renameProjectEntry(root, relative, destination) {
  const base = await realpath(root);
  const source = await resolveProjectPath(root, relative);
  if (source === base)
    throw new Error("The project folder cannot be renamed here");
  const target = await newEntryPath(root, destination);
  await rename(path.resolve(base, relative), target);
  return {
    path: destination,
    name: path.basename(destination),
    directory: (await stat(target)).isDirectory(),
  };
}
