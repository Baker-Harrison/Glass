import { packager } from "@electron/packager";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const paths = await packager({
  dir: root,
  out: path.join(root, "release"),
  name: "Glass",
  executableName: "Glass",
  icon: path.join(root, "assets/glass.icns"),
  appBundleId: "local.glass.agent",
  appCategoryType: "public.app-category.developer-tools",
  platform: "darwin",
  arch: process.arch,
  electronVersion: "44.2.0",
  overwrite: true,
  asar: false,
  prune: true,
  ignore: [
    /^\/(src|vendor|tests|scripts|release|docs)(\/|$)/,
    /^\/(PARITY|REQUIREMENTS)\.md$/,
    /^\/vite\.config\.js$/,
    /^\/\.env/,
  ],
});
for (const output of paths)
  process.stdout.write(path.join(output, "Glass.app") + "\n");
