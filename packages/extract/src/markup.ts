const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));

/** HTML (or OpenDocument XML) to text with line breaks at blocks and list items. */
export function markupToText(markup: string): string {
  return decode(
    markup
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<text:line-break\/>/gi, "\n")
      .replace(/<li[^>]*>|<text:list-item[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|header)>|<\/text:(p|h)>/gi, "\n")
      .replace(/<text:tab\/>/gi, "\t")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Windows-1252 characters 0x80–0x9F (curly quotes, dashes, bullet…); the rest map to Latin-1. */
const CP1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
const cp1252 = (code: number) => (code >= 0x80 && code <= 0x9f ? CP1252[code - 0x80]! : String.fromCharCode(code));

/** RTF to plain text: keeps paragraphs, drops control words, groups like fonts and colours. */
export function rtfToText(rtf: string): string {
  let out = rtf.replace(/\{\\\*[^{}]*\}|\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*\}?/g, "");
  out = out
    .replace(/\\par[d]?\b ?|\\line\b ?/g, "\n")
    .replace(/\\tab\b ?/g, "\t")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => cp1252(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n: string) => String.fromCodePoint((Number(n) + 65536) % 65536))
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\\([\\{}])/g, "$1");
  return out.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
