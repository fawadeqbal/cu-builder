/**
 * Guards against AI inventing facts. Numbers are the easiest thing to fabricate and the most
 * damaging in a CV, so any number in a suggestion that doesn't appear in the source text is
 * replaced with a "[number]" placeholder for the person to fill in.
 */

const NUMBER = /(?<![\w[])(\d+(?:[.,]\d+)*\s*%?|\$\s?\d+(?:[.,]\d+)*[kKmMbB]?)(?![\w\]])/g;

const normalise = (n: string) => n.replace(/[\s$,]/g, "").replace(/\.0+$/, "").toLowerCase();

export function numbersIn(text: string): Set<string> {
  return new Set([...text.matchAll(NUMBER)].map((m) => normalise(m[1] ?? m[0])));
}

/** Replace numbers not present in `source` with "[number]". */
export function guardNumbers(suggestion: string, source: string): string {
  const allowed = numbersIn(source);
  return suggestion.replace(NUMBER, (match, n: string) => (allowed.has(normalise(n ?? match)) ? match : "[number]"));
}

/** True when the suggestion contains placeholders the person must fill. */
export const hasPlaceholders = (text: string): boolean => /\[(number|metric|tool|team size|[a-z ]{2,20})\]/i.test(text);

/** Trims quotes, bullets and labels models sometimes add. */
export function cleanLine(text: string): string {
  const quotes = /^["'“”‘’]+|["'“”‘’]+$/g;
  return text
    .trim()
    .replace(/^(?:[-*•·]|\d+[.)])\s+/, "")
    .replace(/^(option|suggestion)\s*\d*\s*[:.-]\s*/i, "")
    .replace(quotes, "")
    .trim();
}
