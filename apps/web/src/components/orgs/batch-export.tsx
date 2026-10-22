"use client";

import type { CandidateDto, OrgDto } from "@cvb/contracts";
import { normalizeCV, withoutContacts } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { isTemplateId } from "@cvb/templates/catalog";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { downloadBlob } from "@/lib/download";
import { buildCvPdf } from "@/lib/pdf";

export const brandOf = (org: OrgDto) => ({ name: org.branding.productName || org.name, logoUrl: org.branding.logoUrl });

/** The candidate's CV as the client sees it: agency template, contacts hidden when asked. */
export function candidateCv(c: CandidateDto) {
  const cv = normalizeCV(c.data);
  return c.hideContacts ? withoutContacts(cv) : cv;
}

export const candidateTemplate = (c: CandidateDto, org: OrgDto) => {
  const id = c.templateId ?? org.defaultTemplateId ?? "classic";
  return isTemplateId(id) ? id : "classic";
};

const fileBase = (c: CandidateDto) =>
  (c.name || c.fileName.replace(/\.[a-z]+$/i, "") || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "candidate";

/** Renders one candidate off-screen and returns its PDF. */
async function candidatePdf(c: CandidateDto, org: OrgDto): Promise<Blob> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", pointerEvents: "none" });
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() =>
      root.render(
        <div className="paper" data-size="a4">
          <CVDocument cv={candidateCv(c)} template={candidateTemplate(c, org)} brand={brandOf(org)} />
        </div>,
      ),
    );
    await document.fonts?.ready;
    const paper = host.querySelector<HTMLElement>(".paper")!;
    return await buildCvPdf(paper, { title: `${c.name || "Candidate"} CV`, author: brandOf(org).name, pageSize: "A4" });
  } finally {
    root.unmount();
    host.remove();
  }
}

/** One ZIP with a PDF per ready candidate, in the agency's template. */
export async function exportCandidatesZip(candidates: CandidateDto[], org: OrgDto, onProgress: (done: number, total: number) => void): Promise<void> {
  const ready = candidates.filter((c) => c.status === "ready" && c.data);
  const { zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const [i, c] of ready.entries()) {
    onProgress(i, ready.length);
    let name = `${fileBase(c)}-cv.pdf`;
    for (let n = 2; used.has(name); n++) name = `${fileBase(c)}-${n}-cv.pdf`;
    used.add(name);
    files[name] = new Uint8Array(await (await candidatePdf(c, org)).arrayBuffer());
  }
  onProgress(ready.length, ready.length);
  const zip = zipSync(files, { level: 0 });
  downloadBlob(new Blob([zip as BlobPart], { type: "application/zip" }), `${org.slug}-candidates.zip`);
}

export async function exportCandidatePdf(c: CandidateDto, org: OrgDto): Promise<void> {
  downloadBlob(await candidatePdf(c, org), `${fileBase(c)}-cv.pdf`);
}
