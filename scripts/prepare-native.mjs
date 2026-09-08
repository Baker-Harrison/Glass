import { chmod, stat } from "node:fs/promises";
import path from "node:path";
if (process.platform === "darwin") {
  const helper = path.resolve(
    "node_modules/node-pty/prebuilds",
    `${process.platform}-${process.arch}`,
    "spawn-helper",
  );
  try {
    const info = await stat(helper);
    await chmod(helper, info.mode | 0o111);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
