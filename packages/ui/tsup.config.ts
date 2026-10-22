import { execFileSync } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  // Watch mode rebuilds in place: cleaning would delete files the running apps are reading.
  clean: !options.watch,
  target: "es2023",
  external: ["react", "react/jsx-runtime", "react-dom"],
  // Components use hooks; mark the bundle as client code for React Server Components.
  banner: { js: '"use client";' },
  onSuccess: async () => {
    execFileSync(process.execPath, ["scripts/build-tokens.mjs"], { stdio: "inherit" });
    await copyFile("src/tokens.css", "dist/tokens.css");
    await copyFile("src/styles.css", "dist/styles.css");
  },
}));
