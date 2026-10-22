import type { PageSize } from "@cvb/contracts";

export type { PageSize };

/** Paper sizes a CV can be printed on, in millimetres. */
export const PAGE_SIZES: Record<PageSize, { label: string; w: number; h: number; pdf: "a4" | "letter" }> = {
  A4: { label: "A4", w: 210, h: 297, pdf: "a4" },
  LETTER: { label: "US Letter", w: 215.9, h: 279.4, pdf: "letter" },
};

export const isPageSize = (v: unknown): v is PageSize => v === "A4" || v === "LETTER";

/** `data-size` value for the `.paper` element (see @cvb/templates/styles.css). */
export const paperSizeAttr = (size: PageSize) => (size === "LETTER" ? "letter" : "a4");
