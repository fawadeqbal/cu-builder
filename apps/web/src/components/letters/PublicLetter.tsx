"use client";

import type { PublicLetterDto } from "@cvb/contracts";
import { CoverLetterDocument, isTemplateId } from "@cvb/templates";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button, LogoMark } from "@cvb/ui";
import { api } from "@/lib/api";
import { paperSizeAttr } from "@/lib/page";
import { downloadCvPdf } from "@/lib/pdf";
import { FullPageMessage } from "../ui/FullPageMessage";

/** The read-only page behind a cover letter's share link. */
export default function PublicLetter({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ["public-letter", slug], queryFn: () => api.get<PublicLetterDto>(`/public/l/${encodeURIComponent(slug)}`), retry: false, staleTime: Infinity });
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <FullPageMessage>Loading…</FullPageMessage>;
  if (!q.data) return <FullPageMessage>This letter isn&apos;t available.</FullPageMessage>;
  const l = q.data;
  const template = isTemplateId(l.templateId) ? l.templateId : "classic";
  const doc = <CoverLetterDocument letter={l.data} sender={l.sender} template={template} accent={l.accent} />;

  async function download() {
    const sheet = document.querySelector<HTMLElement>(".print-only .paper");
    if (!sheet) return;
    setBusy(true);
    try {
      await downloadCvPdf(sheet, { fileName: "cover-letter.pdf", title: l.title, author: l.sender.name, pageSize: l.pageSize });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="no-print min-h-dvh bg-canvas">
        <header className="sticky top-0 z-20 border-b border-line bg-surface">
          <div className="mx-auto flex h-16 max-w-(--layout-md) items-center gap-3 px-4 sm:px-6">
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{l.sender.name} · cover letter</h1>
            <Button variant="primary" icon="download" loading={busy} onClick={() => void download()}>
              {busy ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        </header>
        <main className="preview-canvas overflow-x-auto px-2 py-10">
          <div className="paper mx-auto" data-size={paperSizeAttr(l.pageSize)}>
            {doc}
          </div>
          <p className="cvb-caption mt-8 flex items-center justify-center gap-1.5">
            Made with
            <Link href="/" className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
              <LogoMark size={16} /> CV Builder
            </Link>
          </p>
        </main>
      </div>
      <div className="print-only">
        <div className="paper" data-size={paperSizeAttr(l.pageSize)}>
          {doc}
        </div>
      </div>
    </>
  );
}
