/**
 * Builds the CV PDF in the browser and downloads it, without the print dialog.
 *
 * The sheet is rendered by the browser itself (modern-screenshot draws the live DOM through an SVG
 * foreignObject, so fonts, colours and bullets match the preview) and placed on A4 pages with
 * jsPDF. Page breaks avoid splitting a line of text or an entry. On top of the image every line
 * of text is written again as invisible PDF text, and every link becomes a link annotation, so
 * the PDF can still be searched, copied from, read by applicant tracking systems, and clicked.
 */

const PAGE_W = 210;
const PAGE_H = 297;
// Same margins as the @page rule in globals.css, so the PDF matches printing.
const M_TOP = 10;
const M_SIDE = 12;
const M_BOTTOM = 12;
const CONTENT_W = PAGE_W - M_SIDE * 2; // 186mm
const CONTENT_H = PAGE_H - M_TOP - M_BOTTOM; // 275mm
const PIXEL_RATIO = 3; // ~280 dpi on A4: sharp in print, still a small file

/** Blocks that must not be split across pages (mirrors break-inside: avoid in the templates). */
const KEEP_TOGETHER = ".c-entry, .m-entry, .c-skill-row, .m-side-item, .m-lang, .c-header, .m-header, h2, li";

type Box = { top: number; bottom: number };
type TextLine = { text: string; x: number; y: number; w: number; h: number; size: number; bold: boolean };
type LinkBox = { url: string; x: number; y: number; w: number; h: number };

export type PdfOptions = { fileName: string; title: string; author: string };

/** `source` is a rendered `.paper` element holding the CV. */
export async function downloadCvPdf(source: HTMLElement, { fileName, title, author }: PdfOptions): Promise<void> {
  const [{ domToCanvas }, { jsPDF }] = await Promise.all([import("modern-screenshot"), import("jspdf")]);

  // Lay out an off-screen copy at the printed content width, without the sheet's own padding.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${CONTENT_W}mm`,
    background: "#fff",
    pointerEvents: "none",
  });
  const sheet = source.cloneNode(true) as HTMLElement;
  sheet.classList.remove("preview-live");
  Object.assign(sheet.style, { width: "100%", minHeight: "0", padding: "0", boxShadow: "none", margin: "0" });
  host.appendChild(sheet);
  document.body.appendChild(host);

  try {
    await document.fonts.ready;
    const origin = sheet.getBoundingClientRect();
    const pxPerMm = origin.width / CONTENT_W;
    const pageHeightPx = CONTENT_H * pxPerMm;

    const cuts = pageCuts(sheet, origin, pageHeightPx);
    const lines = textLines(sheet, origin);
    const links = linkBoxes(sheet, origin);

    const canvas = await domToCanvas(sheet, {
      scale: PIXEL_RATIO,
      backgroundColor: "#ffffff",
    });
    const scale = canvas.width / origin.width; // canvas px per CSS px

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    pdf.setProperties({ title, author, creator: "CV Builder" });

    const pageOf = (y: number) => {
      let i = 0;
      while (i < cuts.length - 2 && y >= cuts[i + 1]) i++;
      return i;
    };
    const toMm = (px: number) => px / pxPerMm;

    for (let i = 0; i < cuts.length - 1; i++) {
      if (i > 0) pdf.addPage();
      const top = cuts[i];
      const height = cuts[i + 1] - top;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.max(1, Math.round(height * scale));
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.round(top * scale), canvas.width, slice.height, 0, 0, slice.width, slice.height);
      pdf.addImage(slice, "PNG", M_SIDE, M_TOP, CONTENT_W, toMm(height), undefined, "FAST");
    }

    // Invisible text layer: selectable, searchable, readable by ATS.
    for (const line of lines) {
      const page = pageOf(line.y + line.h / 2);
      pdf.setPage(page + 1);
      const sizePt = (line.size / pxPerMm) * (72 / 25.4);
      pdf.setFont("helvetica", line.bold ? "bold" : "normal");
      pdf.setFontSize(sizePt);
      const natural = pdf.getTextWidth(line.text);
      const target = toMm(line.w);
      const x = M_SIDE + toMm(line.x);
      const baseline = M_TOP + toMm(line.y - cuts[page]) + toMm(line.h) * 0.78;
      pdf.text(line.text, x, baseline, {
        renderingMode: "invisible",
        horizontalScale: natural > 0 ? target / natural : 1,
      });
    }

    // Clickable links.
    for (const link of links) {
      const page = pageOf(link.y + link.h / 2);
      pdf.setPage(page + 1);
      pdf.link(M_SIDE + toMm(link.x), M_TOP + toMm(link.y - cuts[page]), toMm(link.w), toMm(link.h), { url: link.url });
    }

    pdf.save(fileName);
  } finally {
    host.remove();
  }
}

/**
 * Where each page starts and ends, in CSS px from the top of the sheet. A cut never falls
 * inside a line of text or a keep-together block; if a block is taller than a page it is split
 * between lines instead.
 */
function pageCuts(sheet: HTMLElement, origin: DOMRect, pageH: number): number[] {
  const total = sheet.scrollHeight;
  const blocks: Box[] = [];
  sheet.querySelectorAll<HTMLElement>(KEEP_TOGETHER).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < pageH * 0.9) blocks.push({ top: r.top - origin.top, bottom: r.bottom - origin.top });
  });
  const lineBoxes = textLines(sheet, origin).map((l) => ({ top: l.y, bottom: l.y + l.h }));

  const inside = (y: number, boxes: Box[]) => boxes.some((b) => y > b.top + 0.5 && y < b.bottom - 0.5);
  const cuts = [0];
  let start = 0;
  while (total - start > pageH + 0.5) {
    const limit = start + pageH;
    let cut = -1;
    // Walk up from the bottom of the page to the first clean gap, but not above half a page.
    for (let y = Math.floor(limit); y > start + pageH * 0.5; y--) {
      if (!inside(y, blocks) && !inside(y, lineBoxes)) {
        cut = y;
        break;
      }
    }
    if (cut < 0) {
      for (let y = Math.floor(limit); y > start + pageH * 0.25; y--) {
        if (!inside(y, lineBoxes)) {
          cut = y;
          break;
        }
      }
    }
    if (cut < 0) cut = limit;
    cuts.push(cut);
    start = cut;
  }
  cuts.push(total);
  return cuts;
}

/** Every visual line of text in the sheet, with its box and font. */
function textLines(sheet: HTMLElement, origin: DOMRect): TextLine[] {
  const out: TextLine[] = [];
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.data;
    if (!value.trim()) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    const style = getComputedStyle(parent);
    const size = parseFloat(style.fontSize) || 11;
    const bold = (parseInt(style.fontWeight, 10) || 400) >= 600;
    const transform = style.textTransform;

    let current: TextLine | null = null;
    for (const m of value.matchAll(/\S+/g)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      const word = transform === "uppercase" ? m[0].toUpperCase() : m[0];
      const x = r.left - origin.left;
      const y = r.top - origin.top;
      if (current && Math.abs(current.y - y) < r.height * 0.5) {
        current.text += ` ${word}`;
        current.w = x + r.width - current.x;
        current.h = Math.max(current.h, r.height);
      } else {
        if (current) out.push(current);
        current = { text: word, x, y, w: r.width, h: r.height, size, bold };
      }
    }
    if (current) out.push(current);
  }
  range.detach();
  return out;
}

function linkBoxes(sheet: HTMLElement, origin: DOMRect): LinkBox[] {
  const out: LinkBox[] = [];
  sheet.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    for (const r of Array.from(a.getClientRects())) {
      if (r.width && r.height) {
        out.push({ url: a.href, x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
      }
    }
  });
  return out;
}
