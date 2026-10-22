import type { PageSize } from "./page";

export type ExportFormat = "pdf" | "docx" | "txt" | "json";

/** What the editor's download controls need; the builder decides gating and how files are made. */
export type ExportActions = {
  exportAs: (format: ExportFormat) => void;
  /** The format being prepared right now. */
  busy: ExportFormat | null;
  /** Formats the current plan doesn't include (shown with a lock; choosing one explains the upgrade). */
  locked: ExportFormat[];
  pageSize: PageSize;
  onPageSize: (size: PageSize) => void;
  /** Where "Browse all templates" goes (the gallery knows which CV to change). */
  templatesHref: string;
};

export const EXPORT_LABEL: Record<ExportFormat, string> = {
  pdf: "PDF",
  docx: "Word (.docx)",
  txt: "Plain text (.txt)",
  json: "Backup (.json)",
};
