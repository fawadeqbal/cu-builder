import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/anthropic.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  external: ["@anthropic-ai/sdk"],
});
