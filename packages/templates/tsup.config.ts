import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx", "src/catalog.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  external: ["react", "react/jsx-runtime"],
  // The stylesheet ships as-is next to the JS (works the same on Windows, macOS and Linux).
  onSuccess: async () => {
    await copyFile("src/styles.css", "dist/styles.css");
  },
});
