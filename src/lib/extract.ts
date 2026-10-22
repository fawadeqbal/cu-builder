/** Reads the text out of a CV file in the browser. Nothing is uploaded. */

export type FileKind = "pdf" | "docx" | "text" | "json";

export function fileKind(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".json")) return "json";
  if (/\.(txt|md|text|rtf)$/.test(name) || file.type.startsWith("text/")) return "text";
  return null;
}

export const ACCEPT = ".pdf,.docx,.txt,.md,.json,application/pdf,application/json,text/plain";

async function pdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (item.str && !item.str.endsWith(" ")) {
        line += " ";
      }
    }
    if (line.trim()) lines.push(line);
    pages.push(lines.map((l) => l.replace(/\s+/g, " ").trim()).join("\n"));
  }
  await doc.cleanup();
  return pages.join("\n\n");
}

async function docxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export async function extractText(file: File): Promise<string> {
  const kind = fileKind(file);
  let text = "";
  if (kind === "pdf") text = await pdfText(file);
  else if (kind === "docx") text = await docxText(file);
  else text = await file.text();
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
