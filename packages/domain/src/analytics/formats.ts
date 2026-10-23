/** The format of an imported CV file, for analytics (never the file name itself). */
export type ImportFormat = "pdf" | "docx" | "doc" | "odt" | "rtf" | "txt" | "html" | "json" | "linkedin" | "other";

export function importFormat(mimeType: string | null | undefined, fileName?: string | null): ImportFormat {
  const mime = (mimeType ?? "").toLowerCase();
  const ext = (fileName ?? "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (mime === "application/x-linkedin-export+zip" || ext === "zip") return "linkedin";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.includes("wordprocessingml") || ext === "docx") return "docx";
  if (mime === "application/msword" || ext === "doc") return "doc";
  if (mime.includes("opendocument.text") || ext === "odt") return "odt";
  if (mime.includes("rtf") || ext === "rtf") return "rtf";
  if (mime === "application/json" || ext === "json") return "json";
  if (mime === "text/html" || ext === "html" || ext === "htm") return "html";
  if (mime.startsWith("text/") || ext === "txt" || ext === "md") return "txt";
  return "other";
}
