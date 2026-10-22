import { strFromU8, unzipSync } from "fflate";
import mammoth from "mammoth";
import { extractText as pdfText, getDocumentProxy } from "unpdf";
import { markupToText, rtfToText } from "./markup";
import type { DocumentType } from "./sniff";

export type ExtractedText = {
  /** The document's text, with line breaks between paragraphs. */
  text: string;
  /** Number of pages, when the format has pages (PDF). */
  pages?: number;
};

/** The file could not be opened (damaged, password-protected, not what its first bytes said). */
export class ExtractError extends Error {
  constructor(message = "This file couldn't be opened. Check it isn't password-protected or damaged.", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ExtractError";
  }
}

const plain = (bytes: Uint8Array) => new TextDecoder().decode(bytes).replace(/^\uFEFF/, "").replace(/\r/g, "");

/**
 * Plain text from a CV file whose type came from `sniff`. Throws `ExtractError` when the file
 * can't be read. JSON is returned as text (callers that understand CV backups read it themselves).
 */
export async function extractText(bytes: Uint8Array, type: DocumentType): Promise<ExtractedText> {
  try {
    switch (type) {
      case "application/pdf": {
        const pdf = await getDocumentProxy(bytes);
        const { text, totalPages } = await pdfText(pdf, { mergePages: true });
        return { text, pages: totalPages };
      }
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
        return { text: value };
      }
      case "application/vnd.oasis.opendocument.text": {
        const files = unzipSync(bytes, { filter: (f) => f.name === "content.xml" });
        return { text: markupToText(strFromU8(files["content.xml"] ?? new Uint8Array())) };
      }
      case "application/rtf":
        return { text: rtfToText(new TextDecoder("latin1").decode(bytes)) };
      case "text/html":
        return { text: markupToText(new TextDecoder().decode(bytes)) };
      case "text/plain":
      case "application/json":
        return { text: plain(bytes) };
    }
  } catch (e) {
    throw new ExtractError(undefined, { cause: e });
  }
}

/** Fewer than 40 letters or digits: nothing worth reading (often a scanned image). */
export const hasReadableText = (text: string): boolean => text.replace(/\s/g, "").length >= 40;
