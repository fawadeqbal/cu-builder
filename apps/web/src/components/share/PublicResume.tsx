"use client";

import type { PublicResumeDto } from "@cvb/contracts";
import { normalizeCV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { isTemplateId } from "@cvb/templates/catalog";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, EmptyState, Icon, TextField } from "@cvb/ui";
import { track } from "@/lib/analytics";
import { ApiError, isApiError } from "@/lib/api";
import { fileSlug } from "@/lib/cv";
import { paperSizeAttr } from "@/lib/page";
import { downloadCvPdf } from "@/lib/pdf";
import { FullPageMessage } from "../ui/FullPageMessage";

/** The read-only page behind a share link: the CV, a download button, nothing to sign in to. */
export default function PublicResume({ slug }: { slug: string }) {
  const [unlocked, setUnlocked] = useState<PublicResumeDto | null>(null);
  const view = useQuery({
    queryKey: ["public", slug],
    queryFn: () => publicRequest<PublicResumeDto>(`/public/r/${encodeURIComponent(slug)}`),
    retry: false,
    staleTime: Infinity,
  });

  if (unlocked) return <Sheet resume={unlocked} slug={slug} />;
  if (view.isLoading) return <FullPageMessage>Loading CV…</FullPageMessage>;
  if (view.data) return <Sheet resume={view.data} slug={slug} />;
  if (isApiError(view.error, "PASSWORD_REQUIRED")) return <PasswordGate slug={slug} onUnlocked={setUnlocked} />;
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <EmptyState
        icon="link"
        title="This link isn't available"
        className="w-full max-w-(--layout-sm) rounded-lg border border-line bg-surface"
        actions={
          <Button variant="primary" href="/">
            Make your own CV with CV Builder
          </Button>
        }
      >
        It may have been turned off, have expired, or the address is mistyped.
      </EmptyState>
    </div>
  );
}

function PasswordGate({ slug, onUnlocked }: { slug: string; onUnlocked: (r: PublicResumeDto) => void }) {
  const [password, setPassword] = useState("");
  const unlock = useMutation({
    mutationFn: () => publicRequest<PublicResumeDto>(`/public/r/${encodeURIComponent(slug)}/unlock`, { password }),
    onSuccess: onUnlocked,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    unlock.mutate();
  };
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-line bg-surface p-6"
      >
        <span className="grid size-10 place-items-center rounded-lg bg-surface-2 text-ink-2">
          <Icon name="lock" size={20} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="cvb-h2">This CV is password protected</h1>
          <p className="text-sm text-ink-2">Enter the password you were given to view it.</p>
        </div>
        <TextField
          label="Password"
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {unlock.error && (
          <Alert tone="danger">
            {isApiError(unlock.error, "RATE_LIMITED") ? "Too many tries. Please wait a minute." : unlock.error.message}
          </Alert>
        )}
        <Button type="submit" variant="primary" block loading={unlock.isPending}>
          {unlock.isPending ? "Checking…" : "View CV"}
        </Button>
      </form>
    </div>
  );
}

/** Where the visitor came from (LinkedIn, an email…) goes along, for the owner's link analytics. */
async function publicRequest<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-page-referrer": document.referrer.slice(0, 500) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ({ error?: { code: string; message: string } } & T) | null;
  if (!res.ok)
    throw new ApiError(
      res.status,
      json?.error?.code ?? "HTTP_ERROR",
      json?.error?.message ?? `Request failed (${res.status})`,
    );
  return json as T;
}

/** Time on page (every 15 s while visible, and on leaving) and downloads. Best effort. */
function useViewPings(slug: string, viewId: string | null) {
  useEffect(() => {
    if (!viewId) return;
    const started = Date.now();
    let visibleMs = 0;
    let since = document.visibilityState === "visible" ? Date.now() : 0;
    const elapsed = () => visibleMs + (since ? Date.now() - since : 0);
    const send = () =>
      void fetch(`/api/v1/public/r/${encodeURIComponent(slug)}/ping`, {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewId, durationMs: Math.min(elapsed(), 6 * 3600 * 1000) }),
      }).catch(() => undefined);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (since) visibleMs += Date.now() - since;
        since = 0;
        send();
      } else since = Date.now();
    };
    const timer = window.setInterval(
      () => document.visibilityState === "visible" && Date.now() - started < 30 * 60_000 && send(),
      15_000,
    );
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
    };
  }, [slug, viewId]);
}

function Sheet({ resume, slug }: { resume: PublicResumeDto; slug: string }) {
  useViewPings(slug, resume.viewId);
  // Product analytics: the path is recorded as /r/:slug, never the link itself.
  useEffect(() => track("share_link_viewed"), []);
  const cv = normalizeCV(resume.data);
  const template = isTemplateId(resume.templateId) ? resume.templateId : "classic";
  const wrap = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${resume.ownerName || resume.title} · CV`;
  }, [resume]);

  useLayoutEffect(() => {
    const measure = () => {
      if (!wrap.current || !paper.current) return;
      const w = paper.current.offsetWidth;
      setSize({ w, h: paper.current.offsetHeight });
      const pad = getComputedStyle(wrap.current);
      const inner = wrap.current.clientWidth - parseFloat(pad.paddingInlineStart) - parseFloat(pad.paddingInlineEnd);
      setScale(Math.min(1, inner / w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  async function download() {
    const sheet = document.querySelector<HTMLElement>(".print-only .paper");
    if (!sheet) return;
    setBusy(true);
    try {
      await downloadCvPdf(sheet, {
        fileName: `${fileSlug(cv)}-cv.pdf`,
        title: resume.title,
        author: resume.ownerName,
        pageSize: resume.pageSize,
      });
      if (resume.viewId)
        void publicRequest(`/public/r/${encodeURIComponent(slug)}/ping`, {
          viewId: resume.viewId,
          downloaded: true,
        }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="no-print min-h-dvh bg-canvas">
        <header className="sticky top-0 z-20 border-b border-line bg-surface">
          <div className="mx-auto flex min-h-14 max-w-(--layout-md) items-center gap-3 px-4 py-2 sm:px-6">
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-base font-semibold text-ink [&:lang(ur)]:leading-[1.9]">
                {cv.personal.name || resume.ownerName}
              </h1>
              {cv.personal.headline && (
                <p className="cvb-caption truncate text-ink-3 [&:lang(ur)]:leading-[1.9]">{cv.personal.headline}</p>
              )}
            </div>
            <Button variant="primary" icon="download" loading={busy} onClick={() => void download()}>
              {busy ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        </header>
        <main ref={wrap} className="mx-auto max-w-(--layout-md) px-4 py-10 sm:px-6">
          <div
            className="mx-auto"
            style={{ width: size.w ? size.w * scale : undefined, height: size.h ? size.h * scale : undefined }}
          >
            <div className="origin-top-left rtl:origin-top-right" style={{ transform: `scale(${scale})` }}>
              <div ref={paper} className="paper" data-size={paperSizeAttr(resume.pageSize)}>
                <CVDocument cv={cv} template={template} accent={resume.accent} />
              </div>
            </div>
          </div>
          <p className="cvb-caption mt-8 text-center text-ink-3">
            Made with{" "}
            <Link href="/" className="font-semibold text-brand-ink hover:underline">
              CV Builder
            </Link>
            . Make yours free.
          </p>
        </main>
      </div>
      <div className="print-only">
        {resume.pageSize === "LETTER" && <style>{"@page{size:letter}"}</style>}
        <div className="paper" data-size={paperSizeAttr(resume.pageSize)}>
          <CVDocument cv={cv} template={template} accent={resume.accent} />
        </div>
      </div>
    </>
  );
}
