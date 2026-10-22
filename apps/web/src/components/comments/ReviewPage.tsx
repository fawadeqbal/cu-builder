"use client";

import type { CommentDto, ReviewResumeDto } from "@cvb/contracts";
import { cvLines, normalizeCV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { isTemplateId } from "@cvb/templates/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { paperSizeAttr } from "@/lib/page";
import { useMe } from "@/lib/queries";
import { serviceKeys, useComments } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { FullPageMessage } from "../ui/FullPageMessage";
import { Alert, Badge, Button, Checkbox, EmptyState, PageHeader, PreviewCanvas, Spinner, TextArea } from "@cvb/ui";
import { CommentCard } from "./CommentCard";

/** An expert's or career-office reviewer's view of someone's CV: read it, comment line by line. */
export function ReviewPage({ resumeId }: { resumeId: string }) {
  return <RequireAuth>{() => <Review resumeId={resumeId} />}</RequireAuth>;
}

function Review({ resumeId }: { resumeId: string }) {
  const resume = useQuery({
    queryKey: ["review", resumeId],
    queryFn: () => api.get<ReviewResumeDto>(`/review/resumes/${resumeId}`),
    retry: false,
  });
  if (resume.isLoading)
    return (
      <FullPageMessage>
        <span className="flex items-center gap-3">
          <Spinner /> Opening the CV…
        </span>
      </FullPageMessage>
    );
  if (!resume.data)
    return (
      <div className="min-h-dvh bg-canvas">
        <AppHeader />
        <div className="mx-auto max-w-(--layout-sm) px-4 pt-10 sm:px-6">
          <EmptyState
            icon="lock"
            title="You don't have access to this CV, or it was deleted."
            className="rounded-lg border border-line bg-surface"
          />
        </div>
      </div>
    );
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
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex max-w-(--layout-xl) flex-col gap-6 px-4 pb-16 pt-10 sm:px-6">
        <PageHeader
          back={r.orderId ? { href: `/orders/${r.orderId}`, label: "Back to the order" } : undefined}
          title={<span className="break-words">Reviewing {r.ownerName ? `${r.ownerName}'s CV` : r.title}</span>}
          description="Pick a line on the right to comment on it. The owner sees your comments next to their CV in the editor."
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <Paper r={r} />
          <aside className="flex min-w-0 flex-col gap-6" aria-label="Lines and comments">
            {sections.map((section) => (
              <section key={section} className="flex flex-col gap-2">
                <h2 className="cvb-overline text-ink-3">{section}</h2>
                <ul className="flex flex-col gap-2">
                  {lines
                    .filter((l) => l.section === section)
                    .map((l) => {
                      const here = byAnchor.get(l.anchor) ?? [];
                      const on = selected === l.anchor;
                      return (
                        <li
                          key={l.anchor}
                          className={`overflow-hidden rounded-lg border bg-surface ${on ? "border-brand shadow-[0_0_0_1px_var(--brand)]" : "border-line"}`}
                        >
                          <button
                            type="button"
                            aria-expanded={on}
                            className="flex w-full flex-col gap-0.5 px-4 py-3 text-start text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                            onClick={() => setSelected(on ? null : l.anchor)}
                          >
                            <span className="cvb-caption text-ink-3">{l.label}</span>
                            <span className={`text-ink ${on ? "" : "line-clamp-2"}`}>{l.text}</span>
                            {here.length > 0 && (
                              <span className="mt-1">
                                <Badge tone="brand" icon="message">
                                  {here.length} comment{here.length > 1 ? "s" : ""}
                                </Badge>
                              </span>
                            )}
                          </button>
                          {on && (
                            <div className="flex flex-col gap-3 border-t border-line bg-surface-2 p-4">
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
              <section className="flex flex-col gap-2">
                <h2 className="cvb-overline text-ink-3">On lines that were removed</h2>
                <div className="flex flex-col gap-2">
                  {orphaned.map((c) => (
                    <OwnComment key={c.id} c={c} resumeId={r.id} />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function OwnComment({ c, resumeId }: { c: CommentDto; resumeId: string }) {
  const me = useMe();
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.delete(`/comments/${c.id}`),
    onSuccess: () =>
      qc.setQueryData<CommentDto[]>(serviceKeys.comments(resumeId), (all) => all?.filter((x) => x.id !== c.id)),
  });
  return <CommentCard comment={c} onDelete={c.author.id === me.data?.id ? () => remove.mutate() : undefined} />;
}

function NewComment({
  resumeId,
  anchor,
  text,
  onDone,
}: {
  resumeId: string;
  anchor: string;
  text: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [suggest, setSuggest] = useState(false);
  const [suggestion, setSuggestion] = useState(text);
  const add = useMutation({
    mutationFn: () =>
      api.post<CommentDto>(`/resumes/${resumeId}/comments`, {
        anchor,
        body,
        ...(suggest && suggestion.trim() && suggestion !== text ? { suggestion } : {}),
      }),
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
    <form onSubmit={submit} className="flex flex-col gap-3">
      <TextArea
        id={`c-${anchor}`}
        label="Comment"
        rows={3}
        placeholder="What should change, and why?"
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
      />
      <Checkbox
        label="Suggest a rewrite they can apply in one click"
        checked={suggest}
        onChange={(e) => setSuggest(e.target.checked)}
      />
      {suggest && (
        <TextArea
          id={`s-${anchor}`}
          label="Suggested text"
          rows={3}
          value={suggestion}
          maxLength={2000}
          onChange={(e) => setSuggestion(e.target.value)}
        />
      )}
      {add.error && <Alert tone="danger">{add.error.message}</Alert>}
      <Button
        type="submit"
        variant="primary"
        icon="message"
        className="self-end"
        loading={add.isPending}
        disabled={!body.trim()}
      >
        Add comment
      </Button>
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
      setScale(Math.min(1, wrap.current.clientWidth / w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  return (
    <PreviewCanvas className="min-w-0 grid-cols-[minmax(0,1fr)] self-start border border-line p-4 sm:p-6 lg:sticky lg:top-20">
      <div ref={wrap} className="w-full min-w-0">
        <div
          className="mx-auto"
          style={{ width: size.w ? size.w * scale : undefined, height: size.h ? size.h * scale : undefined }}
        >
          <div className="origin-top-left rtl:origin-top-right" style={{ transform: `scale(${scale})` }}>
            <div ref={paper} className="paper shadow-[var(--shadow-paper)]" data-size={paperSizeAttr(r.pageSize)}>
              <CVDocument cv={cv} template={template} accent={r.accent} />
            </div>
          </div>
        </div>
      </div>
    </PreviewCanvas>
  );
}
