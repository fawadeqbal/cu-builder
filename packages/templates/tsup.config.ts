import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.tsx", "src/catalog.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  // Watch mode rebuilds in place: cleaning would delete files the running apps are reading.
  clean: !options.watch,
  target: "es2023",
  external: ["react", "react/jsx-runtime"],
  // The stylesheet ships as-is next to the JS (works the same on Windows, macOS and Linux).
  onSuccess: async () => {
    await copyFile("src/styles.css", "dist/styles.css");
  },
}));
