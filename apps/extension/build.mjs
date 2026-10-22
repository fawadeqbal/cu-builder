// Bundles the extension into dist/ (load it unpacked from there) and writes the icons.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

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
});

for (const f of readdirSync(join(root, "static"))) copyFileSync(join(root, "static", f), join(out, f));

// Icons: a brand-blue rounded square with a white "page" mark, drawn pixel by pixel into a PNG.
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
      const page = x >= size * 0.3 && x < size * 0.7 && y >= size * 0.22 && y < size * 0.78;
      const line = page && (Math.floor((y - size * 0.34) / (size * 0.11)) % 2 === 0) && y >= size * 0.34 && y < size * 0.68 && x >= size * 0.37 && x < size * 0.63;
      if (!inside) row.push(0, 0, 0, 0);
      else if (line) row.push(30, 75, 143, 255);
      else if (page) row.push(255, 255, 255, 255);
      else row.push(30, 75, 143, 255);
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
