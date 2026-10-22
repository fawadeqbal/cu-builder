/** File types we can read text from (the same list as `IMPORT_MIME_TYPES` in @cvb/contracts). */
export type DocumentType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.oasis.opendocument.text"
  | "application/rtf"
  | "text/plain"
  | "text/html"
  | "application/json";

/** A file extension for each type, for storage keys and download names. */
export const DOCUMENT_EXTENSIONS: Record<DocumentType, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/rtf": "rtf",
  "text/plain": "txt",
  "text/html": "html",
  "application/json": "json",
};

const latin1 = (bytes: Uint8Array, start: number, end: number) => new TextDecoder("latin1").decode(bytes.subarray(start, end));
const utf8 = (bytes: Uint8Array, start: number, end: number) => new TextDecoder("utf-8").decode(bytes.subarray(start, end));

/** Text that is valid UTF-8 and mostly printable (not a binary file with a .txt name). */
function looksLikeText(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 4096);
  if (head.includes(0)) return false;
  const bad = (utf8(head, 0, head.length).match(/�/g) ?? []).length;
  return bad < 3;
}

/**
 * Works out the file type from its first bytes (and, for text, its name), never just from the
 * browser's claim. Returns a message for files we can recognise but not read.
 */
export function sniff(bytes: Uint8Array, name: string): DocumentType | { error: string } {
  const lower = name.toLowerCase();
  if (latin1(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    if (latin1(bytes, 0, 200).includes("application/vnd.oasis.opendocument.text")) return "application/vnd.oasis.opendocument.text";
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return { error: "Old Word (.doc) files can't be read. Open it in Word or Google Docs and save it as .docx or PDF." };
  }
  if ((bytes[0] === 0xff && bytes[1] === 0xd8) || latin1(bytes, 1, 4) === "PNG") {
    return { error: "This looks like a photo or scan. Export your CV as a PDF with selectable text, or a Word file." };
  }
  const start = utf8(bytes, 0, 64).replace(/^\uFEFF/, "").trimStart();
  if (start.startsWith("{\\rtf")) return "application/rtf";
  if (!looksLikeText(bytes)) return { error: "Only PDF, Word, OpenDocument, RTF, text, HTML and JSON files can be imported" };
  if (start.startsWith("{") || lower.endsWith(".json")) return "application/json";
  if (/^<(!doctype html|html|head|body|div|p|h1)/i.test(start) || /\.html?$/.test(lower)) return "text/html";
  return "text/plain";
}
