import { readdir, readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";

/**
 * One stylesheet per template in src/styles/, joined in file-name order into dist/styles.css:
 * 00 the sheet, 10 the templates, 90 cover letters, 95 shared rules and right-to-left overrides
 * (last, so they win).
 */
async function bundleStyles() {
  const files = (await readdir("src/styles")).filter((f) => f.endsWith(".css")).sort();
  const parts = await Promise.all(files.map(async (f) => `/* ${f} */\n${(await readFile(`src/styles/${f}`, "utf8")).trim()}\n`));
  await writeFile("dist/styles.css", `/* @cvb/templates: the A4 sheet and every CV template (built from src/styles/). */\n\n${parts.join("\n")}`);
}

export default defineConfig((options) => ({
  entry: ["src/index.tsx", "src/catalog.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  // Watch mode rebuilds in place: cleaning would delete files the running apps are reading.
  clean: !options.watch,
  target: "es2023",
  external: ["react", "react/jsx-runtime"],
  onSuccess: bundleStyles,
}));
