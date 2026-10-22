const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "–", mdash: "—", bull: "•", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML to readable plain text: paragraphs and list items on their own lines. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|ul|ol|h[1-6]|section|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Collapses whitespace to single spaces. */
export const oneLine = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

const SALARY =
  /((?:USD|EUR|GBP|PKR|AED|SAR|QAR|INR|CAD|AUD|Rs\.?|\$|£|€)\s?\d[\d,.]*\s?[kK]?(?:\s?(?:-|–|to)\s?(?:USD|EUR|GBP|PKR|AED|SAR|QAR|INR|CAD|AUD|Rs\.?|\$|£|€)?\s?\d[\d,.]*\s?[kK]?)?(?:\s?(?:per|\/|a)\s?(?:year|yr|annum|month|mo|hour|hr))?)/;

/** The first salary-looking figure in a text ("$120,000 – $150,000 a year"), or "". */
export function findSalary(text: string): string {
  return oneLine(text.match(SALARY)?.[1] ?? "");
}

export const looksRemote = (...parts: string[]): boolean => /\b(remote|work from home|wfh|telecommute|anywhere)\b/i.test(parts.join(" "));
