// Bundles the extension into dist/ (load it unpacked from there) and writes the icons.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The design system (packages/ui): tokens for the extension pages, and the same tokens scoped to
// :host for the autofill panel's shadow root on job sites (light by default, dark by system).
const ui = join(root, "../../packages/ui");
const tokensCss = readFileSync(join(ui, "src/tokens.css"), "utf8");
const hostTokens = tokensCss
  .replace(/:root,\n\[data-theme="light"\]/, ":host")
  .replace(/\[data-theme="dark"\] \{[^}]*\}/, "")
  .replace(/:root:not\(\[data-theme="light"\]\)/g, ":host")
  .replace(/:root \{/g, ":host {");

await build({
  entryPoints: { popup: "src/popup.ts", options: "src/options.ts", background: "src/background.ts", content: "src/content/index.ts" },
  absWorkingDir: root,
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome120",
  platform: "browser",
  legalComments: "none",
  logLevel: "warning",
  define: { __TOKENS_CSS__: JSON.stringify(hostTokens) },
});

for (const f of readdirSync(join(root, "static"))) copyFileSync(join(root, "static", f), join(out, f));
writeFileSync(join(out, "tokens.css"), tokensCss);
mkdirSync(join(out, "fonts"));
for (const f of readdirSync(join(ui, "fonts"))) copyFileSync(join(ui, "fonts", f), join(out, "fonts", f));

// Icons: the Folio app icon (white page with a gold folded corner on EU blue), drawn pixel by pixel into a PNG.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function icon(size) {
  const r = size * 0.22;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const cx = Math.min(Math.max(x + 0.5, r), size - r);
      const cy = Math.min(Math.max(y + 0.5, r), size - r);
      const inside = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;
      const page = px >= 0.28 && px < 0.72 && py >= 0.2 && py < 0.8;
      // The folded corner: the page's top inline-end corner, cut on the diagonal and filled gold.
      const foldSize = 0.13;
      const inFoldBox = px >= 0.72 - foldSize && py < 0.2 + foldSize;
      const fold = page && inFoldBox && (px - (0.72 - foldSize)) + (0.2 + foldSize - py) <= foldSize;
      const cut = page && inFoldBox && !fold;
      const line = page && !inFoldBox && px >= 0.36 && ((py >= 0.46 && py < 0.53 && px < 0.62) || (py >= 0.6 && py < 0.67 && px < 0.54));
      const BLUE = [0, 68, 148, 255];
      const GOLD = [255, 214, 23, 255];
      if (!inside) row.push(0, 0, 0, 0);
      else if (fold) row.push(...GOLD);
      else if (cut || line) row.push(...BLUE);
      else if (page) row.push(255, 255, 255, 255);
      else row.push(...BLUE);
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}
for (const s of [16, 48, 128]) writeFileSync(join(out, `icon-${s}.png`), icon(s));

console.log("Built the extension into dist/ — load it unpacked from there.");
