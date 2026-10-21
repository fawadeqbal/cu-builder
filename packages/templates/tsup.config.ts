import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx", "src/catalog.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  external: ["react", "react/jsx-runtime"],
});
