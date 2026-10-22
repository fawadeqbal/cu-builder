/** Colour helpers for white-label branding: validation and WCAG contrast checks. */

export const isHexColor = (v: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

/** "#abc" → "#aabbcc", lowercase. Throws on anything that isn't a hex colour. */
export function expandHex(hex: string): string {
  if (!isHexColor(hex)) throw new Error(`Not a hex colour: ${hex}`);
  const h = hex.slice(1).toLowerCase();
  return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : `#${h}`;
}

const rgb = (hex: string): [number, number, number] => {
  const h = expandHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** White text on buttons needs 4.5:1 (WCAG AA for normal text). */
export const readableWithWhite = (hex: string) => contrastRatio(hex, "#ffffff") >= 4.5;

/** Mixes towards black by `amount` (0–1): the hover shade of a brand colour. */
export function darken(hex: string, amount = 0.2): string {
  return `#${rgb(hex)
    .map((c) => Math.round(c * (1 - amount)).toString(16).padStart(2, "0"))
    .join("")}`;
}
