"use client";

import type { PublicSiteDto } from "@cvb/contracts";
import { normalizeCV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { isTemplateId } from "@cvb/templates/catalog";
import { useRef, useState } from "react";
import { fileSlug } from "@/lib/cv";
import { paperSizeAttr } from "@/lib/page";
import { PortfolioView } from "./PortfolioView";

/** The public portfolio page: the site, its contact form and the CV as a PDF. */
export function PublicSite({ site }: { site: PublicSiteDto }) {
  const cv = normalizeCV(site.data);
  const paper = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const template = isTemplateId(site.templateId) ? site.templateId : "classic";

  async function download() {
    if (!paper.current) return;
    setBusy(true);
    try {
      const { downloadCvPdf } = await import("@/lib/pdf");
      await downloadCvPdf(paper.current, { fileName: `${fileSlug(cv)}-cv.pdf`, title: `${cv.personal.name || site.ownerName} CV`, author: site.ownerName, pageSize: site.pageSize });
    } finally {
      setBusy(false);
    }
  }

  async function contact(form: { name: string; email: string; message: string; website: string }) {
    const res = await fetch(`/api/v1/public/sites/${encodeURIComponent(site.slug)}/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      throw new Error(body?.error?.code === "RATE_LIMITED" ? "Too many messages. Please try again in a minute." : (body?.error?.message ?? "Couldn't send your message"));
    }
  }

  return (
    <>
      <div className="no-print min-h-dvh">
        <PortfolioView
          cv={cv}
          ownerName={site.ownerName}
          theme={site.theme}
          accent={site.accent ?? site.resumeAccent ?? "#1e4b8f"}
          content={site.content}
          showContactForm={site.showContactForm}
          onContact={contact}
          download={{ busy, onClick: () => void download() }}
          hideCredit={site.hideCredit}
          appUrl={site.appUrl}
        />
      </div>
      {/* The CV itself, laid out off screen for the PDF. */}
      <div aria-hidden className="pointer-events-none fixed -start-[10000px] top-0" dir="ltr">
        <div ref={paper} className="paper" data-size={paperSizeAttr(site.pageSize)}>
          <CVDocument cv={cv} template={template} accent={site.resumeAccent} />
        </div>
      </div>
    </>
  );
}
