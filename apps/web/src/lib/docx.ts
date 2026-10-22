import { clean, linkHref, linkLabel, type CV } from "@cvb/domain";
import type { PageSize } from "./page";

/**
 * The CV as an editable Word document. One column, real headings and bullet lists, no tables
 * or text boxes, so it opens cleanly in Word and Google Docs and parses well in ATS.
 */
export async function buildCvDocx(cv: CV, { accent, pageSize }: { accent: string; pageSize: PageSize }): Promise<Blob> {
  const { AlignmentType, BorderStyle, Document, ExternalHyperlink, Packer, Paragraph, TextRun } = await import("docx");

  const color = accent.replace("#", "").toUpperCase();
  const muted = "5B6673";
  const p = cv.personal;
  const children: InstanceType<typeof Paragraph>[] = [];

  const link = (value: string) =>
    new ExternalHyperlink({ link: linkHref(value), children: [new TextRun({ text: linkLabel(value), color, underline: {} })] });

  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 240, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 2 } },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color, characterSpacing: 20 })],
    });

  const titleLine = (left: string, right: string) =>
    new Paragraph({
      spacing: { before: 120, after: 20 },
      children: [
        new TextRun({ text: left, bold: true, size: 21 }),
        ...(right ? [new TextRun({ text: `   ${right}`, color: muted, size: 19 })] : []),
      ],
    });

  const plain = (text: string, opts: { italic?: boolean; color?: string } = {}) =>
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text, size: 20, ...opts })] });

  const bullet = (text: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 20 }, children: [new TextRun({ text, size: 20 })] });

  // Header
  if (p.name.trim()) {
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: p.name.trim(), bold: true, size: 40 })] }));
  }
  if (p.headline.trim()) children.push(plain(p.headline.trim(), { color }));
  const contact = [p.email, p.phone, p.location].map((s) => s.trim()).filter(Boolean);
  if (contact.length) children.push(plain(contact.join("  ·  "), { color: muted }));
  const links = [p.website, p.linkedin, p.github].map((s) => s.trim()).filter(Boolean);
  if (links.length) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: links.flatMap((l, i) => [...(i ? [new TextRun({ text: "  ·  ", color: muted })] : []), link(l)]),
      }),
    );
  }

  if (cv.summary.trim()) {
    children.push(heading("Summary"), plain(cv.summary.trim()));
  }

  if (cv.experience.length) {
    children.push(heading("Experience"));
    for (const e of cv.experience) {
      const title = [e.role, e.company].map((s) => s.trim()).filter(Boolean).join(", ");
      children.push(titleLine(title, [e.location, e.date].map((s) => s.trim()).filter(Boolean).join(" · ")));
      clean(e.bullets).forEach((b) => children.push(bullet(b)));
      if (e.stack.trim()) children.push(plain(`Stack: ${e.stack.trim()}`, { color: muted }));
    }
  }

  if (cv.projects.length) {
    children.push(heading("Projects"));
    for (const pr of cv.projects) {
      children.push(titleLine(pr.name.trim(), pr.date.trim()));
      const prLinks = pr.links.map((l) => l.trim()).filter(Boolean);
      if (prLinks.length) {
        children.push(new Paragraph({ children: prLinks.flatMap((l, i) => [...(i ? [new TextRun({ text: "  ·  " })] : []), link(l)]) }));
      }
      clean(pr.bullets).forEach((b) => children.push(bullet(b)));
      if (pr.stack.trim()) children.push(plain(`Stack: ${pr.stack.trim()}`, { color: muted }));
    }
  }

  const skills = cv.skills.filter((s) => s.items.trim());
  if (skills.length) {
    children.push(heading("Skills"));
    for (const s of skills) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            ...(s.category.trim() ? [new TextRun({ text: `${s.category.trim()}: `, bold: true, size: 20 })] : []),
            new TextRun({ text: s.items.trim(), size: 20 }),
          ],
        }),
      );
    }
  }

  if (cv.education.length) {
    children.push(heading("Education"));
    for (const e of cv.education) {
      children.push(titleLine([e.degree, e.school].map((s) => s.trim()).filter(Boolean).join(", "), e.date.trim()));
      if (e.details.trim()) children.push(plain(e.details.trim()));
    }
  }

  const certs = cv.certificates.filter((c) => c.name.trim());
  if (certs.length) {
    children.push(heading("Certificates"));
    for (const c of certs) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: c.name.trim(), bold: true, size: 20 }),
            new TextRun({ text: [c.issuer, c.year].map((s) => s.trim()).filter(Boolean).map((s) => ` · ${s}`).join(""), size: 20, color: muted }),
            ...(c.url.trim() ? [new TextRun({ text: "  " }), link(c.url)] : []),
          ],
        }),
      );
    }
  }

  const langs = cv.languages.filter((l) => l.name.trim());
  if (langs.length) {
    children.push(heading("Languages"), plain(langs.map((l) => (l.level.trim() ? `${l.name.trim()} (${l.level.trim()})` : l.name.trim())).join(", ")));
  }

  const size = pageSize === "LETTER" ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 };
  const doc = new Document({
    creator: "CV Builder",
    title: `${p.name.trim() || "My"} CV`,
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{ properties: { page: { size, margin: { top: 680, bottom: 680, left: 760, right: 760 } } }, children }],
  });
  return Packer.toBlob(doc);
}
