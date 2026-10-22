"use client";

import type { PublicLetterDto } from "@cvb/contracts";
import { CoverLetterDocument, isTemplateId } from "@cvb/templates";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { DownloadIcon } from "@cvb/ui";
import { api } from "@/lib/api";
import { paperSizeAttr } from "@/lib/page";
import { downloadCvPdf } from "@/lib/pdf";
import { btn } from "../ui/styles";
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
      <div className="no-print min-h-dvh bg-stone-100">
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
            <div className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-900">{l.sender.name} · cover letter</div>
            <button type="button" onClick={() => void download()} disabled={busy} className={btn.primary}>
              <DownloadIcon className="size-4" /> {busy ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        </header>
        <main className="overflow-x-auto px-2 py-6">
          <div className="paper mx-auto" data-size={paperSizeAttr(l.pageSize)}>
            {doc}
          </div>
          <p className="mt-8 text-center text-xs text-stone-500">
            Made with{" "}
            <Link href="/" className="font-semibold text-brand hover:underline">
              CV Builder
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
