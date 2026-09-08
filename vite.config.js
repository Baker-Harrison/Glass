import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  base: "./",
  resolve: {
    // Monaco also vendors a sanitizer copy; use the patched package in the bundle.
    alias: [
      {
        find: /^\.\/dompurify\/dompurify\.js$/,
        replacement: fileURLToPath(
          new URL(
            "./node_modules/dompurify/dist/purify.es.mjs",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  build: { emptyOutDir: true },
});
