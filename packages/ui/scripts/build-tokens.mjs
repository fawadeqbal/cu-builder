// Compiles tokens.json (the design system's source of truth, same file as the published
// "CV Builder Product" design system) into src/tokens.css.
//
// - Colours and shadows: light on :root / [data-theme="light"], dark on [data-theme="dark"], and dark
//   for people whose system is dark when no theme is chosen (no data-theme attribute).
// - Fonts: each family first names the next/font variable the web app sets (so self-hosted,
//   hashed font files are used), then the real family name (the extension loads the files itself).
// - Container widths are emitted as --layout-* because Tailwind owns --container-* (max-w-sm …).
//
// Run: node scripts/build-tokens.mjs (also runs before every build).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const t = JSON.parse(readFileSync(join(root, "tokens.json"), "utf8"));

const ref = (v) => (typeof v === "string" && v.startsWith("{") ? `var(--${v.slice(1, -1)})` : v);
const block = (selector, lines) => `${selector} {\n${lines.map((l) => `  ${l}`).join("\n")}\n}`;

const themed = (theme) => [
  ...t.color.tokens.map((c) => `--${c.name}: ${ref(c.value[theme])};`),
  ...t.shadow.tokens.map((s) => `--${s.name}: ${s.value[theme]};`),
  // Copies the app bar can't override (it re-points --ink & co. for its own children); popovers
  // opened from the bar read these to get the page colours back.
  ...["ink", "ink-2", "ink-3", "surface-2"].map((n) => `--page-${n}: ${ref(t.color.tokens.find((c) => c.name === n).value[theme])};`),
  `color-scheme: ${theme};`,
];

const FONT_VAR = {
  display: ["--font-schibsted", "--font-plex-arabic", "--font-nastaliq"],
  sans: ["--font-instrument", "--font-plex-arabic", "--font-nastaliq"],
  mono: ["--font-plex-mono"],
  arabic: ["--font-plex-arabic", "--font-instrument"],
  urdu: ["--font-nastaliq", "--font-plex-arabic"],
};
const FAMILY = {
  "--font-schibsted": "Schibsted Grotesk",
  "--font-instrument": "Instrument Sans",
  "--font-plex-mono": "IBM Plex Mono",
  "--font-plex-arabic": "IBM Plex Sans Arabic",
  "--font-nastaliq": "Noto Nastaliq Urdu",
};
const fonts = Object.entries(t.type.families).map(([k, stack]) => {
  const vars = (FONT_VAR[k] ?? []).map((v) => `var(${v}, ${JSON.stringify(FAMILY[v])})`);
  return `--font-${k}: ${[...vars, stack].join(", ")};`;
});

const scalar = [];
for (const fam of ["spacing", "radius", "size", "breakpoint", "zIndex"]) {
  for (const x of t[fam].tokens) {
    const name = x.name.startsWith("container-") ? x.name.replace("container-", "layout-") : x.name;
    scalar.push(`--${name}: ${x.value};`);
  }
}

const css = [
  "/* Generated from tokens.json by scripts/build-tokens.mjs. Do not edit by hand. */",
  block(':root,\n[data-theme="light"]', themed("light")),
  block('[data-theme="dark"]', themed("dark")),
  `@media (prefers-color-scheme: dark) {\n${block('  :root:not([data-theme="light"])', themed("dark")).replace(/\n/g, "\n  ")}\n}`,
  block(":root", [...fonts, ...scalar]),
  "",
].join("\n\n");

writeFileSync(join(root, "src/tokens.css"), css);
console.log(`tokens.css: ${t.color.tokens.length} colours, ${t.shadow.tokens.length} shadows, ${scalar.length} scalars`);
