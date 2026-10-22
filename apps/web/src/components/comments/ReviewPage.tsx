"use client";

import type { CommentDto, ReviewResumeDto } from "@cvb/contracts";
import { cvLines, normalizeCV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { isTemplateId } from "@cvb/templates/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { paperSizeAttr } from "@/lib/page";
import { useMe } from "@/lib/queries";
import { serviceKeys, useComments } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { FullPageMessage } from "../ui/FullPageMessage";
import { btn, field, label } from "../ui/styles";
import { CommentCard } from "./CommentCard";

/** An expert's or career-office reviewer's view of someone's CV: read it, comment line by line. */
export function ReviewPage({ resumeId }: { resumeId: string }) {
  return <RequireAuth>{() => <Review resumeId={resumeId} />}</RequireAuth>;
}

function Review({ resumeId }: { resumeId: string }) {
  const resume = useQuery({ queryKey: ["review", resumeId], queryFn: () => api.get<ReviewResumeDto>(`/review/resumes/${resumeId}`), retry: false });
  if (resume.isLoading) return <FullPageMessage>Opening the CV…</FullPageMessage>;
  if (!resume.data) return <FullPageMessage>You don&apos;t have access to this CV, or it was deleted.</FullPageMessage>;
  return <Loaded r={resume.data} />;
}

function Loaded({ r }: { r: ReviewResumeDto }) {
  const cv = useMemo(() => normalizeCV(r.data), [r.data]);
  const lines = useMemo(() => cvLines(cv), [cv]);
  const comments = useComments(r.id);
  const [selected, setSelected] = useState<string | null>(null);
  const byAnchor = useMemo(() => {
    const m = new Map<string, CommentDto[]>();
    for (const c of comments.data ?? []) m.set(c.anchor, [...(m.get(c.anchor) ?? []), c]);
    return m;
  }, [comments.data]);
  const orphaned = (comments.data ?? []).filter((c) => !lines.some((l) => l.anchor === c.anchor));
  const sections = [...new Set(lines.map((l) => l.section))];

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-stone-900">
              Reviewing {r.ownerName ? `${r.ownerName}'s CV` : r.title}
            </h1>
            <p className="text-xs text-stone-500">Pick a line on the right to comment on it. The owner sees your comments next to their CV in the editor.</p>
          </div>
          {r.orderId && (
            <Link href={`/orders/${r.orderId}`} className={btn.secondary}>
              Back to the order
            </Link>
          )}
        </div>
      </div>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_26rem]">
        <Paper r={r} />
        <aside className="flex flex-col gap-4" aria-label="Lines and comments">
          {sections.map((section) => (
            <section key={section}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{section}</h2>
              <ul className="flex flex-col gap-1.5">
                {lines
                  .filter((l) => l.section === section)
                  .map((l) => {
                    const here = byAnchor.get(l.anchor) ?? [];
                    const on = selected === l.anchor;
                    return (
                      <li key={l.anchor} className={`rounded-xl ring-1 ${on ? "bg-white ring-brand/40" : "bg-white/60 ring-stone-200"}`}>
                        <button type="button" aria-expanded={on} className="block w-full px-3 py-2 text-start text-sm" onClick={() => setSelected(on ? null : l.anchor)}>
                          <span className="block text-[11px] font-medium text-stone-500">{l.label}</span>
                          <span className={`block text-stone-800 ${on ? "" : "line-clamp-2"}`}>{l.text}</span>
                          {here.length > 0 && <span className="mt-1 inline-flex rounded-full bg-violet-50 px-2 py-px text-[11px] font-semibold text-violet-800">{here.length} comment{here.length > 1 ? "s" : ""}</span>}
                        </button>
                        {on && (
                          <div className="flex flex-col gap-2 border-t border-stone-100 p-3">
                            {here.map((c) => (
                              <OwnComment key={c.id} c={c} resumeId={r.id} />
                            ))}
                            <NewComment resumeId={r.id} anchor={l.anchor} text={l.text} onDone={() => undefined} />
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
          {orphaned.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">On lines that were removed</h2>
              <div className="flex flex-col gap-2">
                {orphaned.map((c) => (
                  <OwnComment key={c.id} c={c} resumeId={r.id} />
                ))}
              </div>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}

function OwnComment({ c, resumeId }: { c: CommentDto; resumeId: string }) {
  const me = useMe();
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.delete(`/comments/${c.id}`),
    onSuccess: () => qc.setQueryData<CommentDto[]>(serviceKeys.comments(resumeId), (all) => all?.filter((x) => x.id !== c.id)),
  });
  return <CommentCard comment={c} onDelete={c.author.id === me.data?.id ? () => remove.mutate() : undefined} />;
}

function NewComment({ resumeId, anchor, text, onDone }: { resumeId: string; anchor: string; text: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [suggest, setSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState(text);
  const add = useMutation({
    mutationFn: () => api.post<CommentDto>(`/resumes/${resumeId}/comments`, { anchor, body, ...(suggest && suggestion.trim() && suggestion !== text ? { suggestion } : {}) }),
    onSuccess: (c) => {
      qc.setQueryData<CommentDto[]>(serviceKeys.comments(resumeId), (all) => [...(all ?? []), c]);
      setBody("");
      setSuggest(false);
      setSuggestion(text);
      onDone();
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (body.trim()) add.mutate();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`c-${anchor}`}>
        Comment
      </label>
      <textarea id={`c-${anchor}`} rows={3} className={field} placeholder="What should change, and why?" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input type="checkbox" className="size-3.5 accent-brand" checked={suggest} onChange={(e) => setSuggest(e.target.checked)} /> Suggest a rewrite they can apply in one click
      </label>
      {suggest && (
        <div>
          <label className={label} htmlFor={`s-${anchor}`}>
            Suggested text
          </label>
          <textarea id={`s-${anchor}`} rows={3} className={field} value={suggestion} maxLength={2000} onChange={(e) => setSuggestion(e.target.value)} />
        </div>
      )}
      {add.error && <p className="text-xs text-red-600">{add.error.message}</p>}
      <button type="submit" className={`${btn.primary} self-end`} disabled={add.isPending || !body.trim()}>
        Add comment
      </button>
    </form>
  );
}

/** The CV as the owner's template renders it, scaled to the column. */
function Paper({ r }: { r: ReviewResumeDto }) {
  const cv = normalizeCV(r.data);
  const template = isTemplateId(r.templateId) ? r.templateId : "classic";
  const wrap = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      if (!wrap.current || !paper.current) return;
      const w = paper.current.offsetWidth;
      setSize({ w, h: paper.current.offsetHeight });
      setScale(Math.min(1, (wrap.current.clientWidth - 8) / w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className="min-w-0">
      <div className="mx-auto lg:sticky lg:top-20" style={{ width: size.w ? size.w * scale : undefined, height: size.h ? size.h * scale : undefined }}>
        <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
          <div ref={paper} className="paper shadow-lg" data-size={paperSizeAttr(r.pageSize)}>
            <CVDocument cv={cv} template={template} accent={r.accent} />
          </div>
        </div>
      </div>
    </div>
  );
}
