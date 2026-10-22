"use client";

import type { ContactMessageDto, MyPortfolioDto, PortfolioDto, SavePortfolioDto } from "@cvb/contracts";
import { normalizeCV, siteSlugProblem } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TrashIcon } from "@cvb/ui";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { useResume, useResumes } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { DomainSetup } from "../branding/DomainSetup";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { btn, card, field, label } from "../ui/styles";
import { PortfolioView, type PortfolioTheme } from "./PortfolioView";

const KEY = ["portfolio"] as const;
const THEMES: { id: PortfolioTheme; name: string; hint: string }[] = [
  { id: "minimal", name: "Minimal", hint: "Clean and typographic" },
  { id: "bold", name: "Bold", hint: "Colour banner up top" },
  { id: "split", name: "Split", hint: "Profile beside your work" },
];

/** "My website": build a personal site from a CV, publish it, connect a domain, read messages. */
export function WebsiteEditor() {
  return (
    <RequireAuth>
      {(me) => (
        <div className="min-h-dvh bg-stone-50">
          <AppHeader />
          <Editor ownerName={me.name} />
        </div>
      )}
    </RequireAuth>
  );
}

function Editor({ ownerName }: { ownerName: string }) {
  const mine = useQuery({ queryKey: KEY, queryFn: () => api.get<MyPortfolioDto>("/portfolio") });
  const resumes = useResumes();
  if (mine.isLoading || resumes.isLoading) return <p className="py-16 text-center text-sm text-stone-500">Loading…</p>;
  if (!mine.data) return <p className="py-16 text-center text-sm text-red-600">{mine.error?.message ?? "Couldn't load your website"}</p>;
  const first = resumes.data?.items[0]?.id;
  if (!mine.data.site && !first) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900">Your website</h1>
        <p className="mt-2 text-sm text-stone-600">Create a CV first; your website is built from it.</p>
      </main>
    );
  }
  const site = mine.data.site;
  const initial: SavePortfolioDto = site
    ? { resumeId: site.resumeId, slug: site.slug, theme: site.theme, accent: site.accent, showContactForm: site.showContactForm, published: site.published, content: site.content }
    : { resumeId: first!, slug: mine.data.suggestedSlug, theme: "minimal", accent: null, showContactForm: true, published: false, content: { about: "", projects: [] } };
  return <Form key={site?.id ?? "new"} data={mine.data} initial={initial} ownerName={ownerName} />;
}

function Form({ data, initial, ownerName }: { data: MyPortfolioDto; initial: SavePortfolioDto; ownerName: string }) {
  const qc = useQueryClient();
  const resumes = useResumes();
  const [f, setF] = useState(initial);
  const [gate, setGate] = useState<Gate | null>(null);
  const resume = useResume(f.resumeId, Boolean(f.resumeId));
  const site = data.site;
  const slugProblem = siteSlugProblem(f.slug);
  const address = data.portfolioDomain ? `${f.slug}.${data.portfolioDomain}` : `${typeof window === "undefined" ? "" : window.location.host}/p/${f.slug}`;

  const save = useMutation({
    mutationFn: (next: SavePortfolioDto) => api.put<PortfolioDto>("/portfolio", next),
    onSuccess: (s) => qc.setQueryData<MyPortfolioDto>(KEY, (d) => d && { ...d, site: s }),
  });
  const remove = useMutation({ mutationFn: () => api.delete("/portfolio"), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const setSite = (s: PortfolioDto) => qc.setQueryData<MyPortfolioDto>(KEY, (d) => d && { ...d, site: s });

  const set = <K extends keyof SavePortfolioDto>(k: K, v: SavePortfolioDto[K]) => setF((x) => ({ ...x, [k]: v }));
  const projects = f.content.projects;
  const setProjects = (p: typeof projects) => set("content", { ...f.content, projects: p });
  const dirty = JSON.stringify(f) !== JSON.stringify(initial) || !site;

  return (
    <main className="mx-auto grid max-w-[90rem] gap-6 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[28rem_1fr]">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">My website</h1>
            <p className="text-sm text-stone-500">A personal site built from your CV. It updates when your CV does.</p>
          </div>
          {site?.published && (
            <a href={site.url} target="_blank" rel="noreferrer noopener" className={btn.secondary}>
              View ↗
            </a>
          )}
        </div>

        <section className={`${card} flex flex-col gap-4 p-5`}>
          <div>
            <label className={label} htmlFor="w-slug">
              Address
            </label>
            <input id="w-slug" className={field} value={f.slug} maxLength={40} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
            <p className={`mt-1 text-xs ${slugProblem ? "text-red-600" : "text-stone-500"}`}>{slugProblem ?? address}</p>
          </div>
          <div>
            <label className={label} htmlFor="w-cv">
              Built from
            </label>
            <select id="w-cv" className={field} value={f.resumeId} onChange={(e) => set("resumeId", e.target.value)}>
              {resumes.data?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className={label}>Look</legend>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <label key={t.id} className={`cursor-pointer rounded-xl p-2.5 text-xs ring-1 transition ${f.theme === t.id ? "bg-brand/5 ring-2 ring-brand" : "ring-stone-200 hover:ring-stone-300"}`}>
                  <input type="radio" name="theme" className="sr-only" checked={f.theme === t.id} onChange={() => set("theme", t.id)} />
                  <span className="block font-semibold text-stone-900">{t.name}</span>
                  <span className="text-stone-500">{t.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-stone-700" htmlFor="w-accent">
              Colour
            </label>
            <input id="w-accent" type="color" className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent" value={f.accent ?? resume.data?.accent ?? "#1e4b8f"} onChange={(e) => set("accent", e.target.value)} />
            {f.accent && (
              <button type="button" className="text-xs font-medium text-stone-500 hover:underline" onClick={() => set("accent", null)}>
                Use the CV&apos;s colour
              </button>
            )}
          </div>
          <div>
            <label className={label} htmlFor="w-about">
              About (optional)
            </label>
            <textarea id="w-about" rows={4} maxLength={4000} className={field} placeholder="Leave empty to use your CV summary" value={f.content.about} onChange={(e) => set("content", { ...f.content, about: e.target.value })} />
          </div>
        </section>

        <section className={`${card} flex flex-col gap-3 p-5`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">Extra projects</h2>
            <button
              type="button"
              className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
              disabled={projects.length >= 12}
              onClick={() => setProjects([...projects, { title: "", description: "", url: "", imageUrl: "" }])}
            >
              + Add
            </button>
          </div>
          <p className="-mt-2 text-xs text-stone-500">Projects from your CV are shown too. Add work samples with a link and an image.</p>
          {projects.map((p, i) => {
            const patch = (v: Partial<typeof p>) => setProjects(projects.map((x, j) => (j === i ? { ...x, ...v } : x)));
            return (
              <div key={i} className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-stone-200">
                <div className="flex gap-2">
                  <input aria-label="Project title" className={field} placeholder="Title" value={p.title} maxLength={120} onChange={(e) => patch({ title: e.target.value })} />
                  <button type="button" className={btn.ghost} aria-label="Remove project" onClick={() => setProjects(projects.filter((_, j) => j !== i))}>
                    <TrashIcon className="size-4" />
                  </button>
                </div>
                <textarea aria-label="Project description" rows={2} className={field} placeholder="What it is and your part in it" value={p.description} maxLength={1200} onChange={(e) => patch({ description: e.target.value })} />
                <input aria-label="Project link" className={field} placeholder="https://… (link)" value={p.url} onChange={(e) => patch({ url: e.target.value.trim() })} />
                <input aria-label="Image link" className={field} placeholder="https://… (image)" value={p.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value.trim() })} />
              </div>
            );
          })}
        </section>

        <section className={`${card} flex flex-col gap-3 p-5`}>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" className="size-4 accent-brand" checked={f.showContactForm} onChange={(e) => set("showContactForm", e.target.checked)} /> Contact form (messages come to your inbox and email)
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" className="size-4 accent-brand" checked={f.published} onChange={(e) => set("published", e.target.checked)} /> Published (anyone with the address can see it)
          </label>
          {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
          <div className="flex items-center justify-between gap-2">
            {site ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
                onClick={() => window.confirm("Delete your website and its messages?") && remove.mutate()}
              >
                <TrashIcon className="size-4" /> Delete site
              </button>
            ) : (
              <span />
            )}
            <button type="button" className={btn.primary} disabled={save.isPending || Boolean(slugProblem) || !dirty} onClick={() => save.mutate(f)}>
              {save.isPending ? "Saving…" : site ? "Save changes" : "Create website"}
            </button>
          </div>
          {site && (
            <p className="text-xs text-stone-500">
              {site.viewCount} {site.viewCount === 1 ? "visit" : "visits"} ·{" "}
              {site.published ? (
                <a href={site.url} target="_blank" rel="noreferrer noopener" className="font-medium text-brand hover:underline">
                  {site.url.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "not published"
              )}
            </p>
          )}
        </section>

        {site && (
          <section className={`${card} flex flex-col gap-3 p-5`}>
            <h2 className="text-sm font-semibold text-stone-900">Your own domain</h2>
            {data.canUseCustomDomain ? (
              <DomainSetup
                status={site.customDomain}
                example="sara.dev"
                onSave={async (domain) => setSite(await api.put<PortfolioDto>("/portfolio/domain", { domain }))}
                onVerify={async () => setSite(await api.post<PortfolioDto>("/portfolio/domain/verify"))}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-stone-600">Use a domain like yourname.com on a paid plan.</p>
                <button type="button" className={btn.secondary} onClick={() => setGate({ kind: "feature", feature: "portfolio.customDomain" })}>
                  Upgrade
                </button>
              </div>
            )}
          </section>
        )}

        {site && <Inbox unread={site.unreadMessages} />}
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
          <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2">
            <span className="flex gap-1">
              <span className="size-2.5 rounded-full bg-stone-300" />
              <span className="size-2.5 rounded-full bg-stone-300" />
              <span className="size-2.5 rounded-full bg-stone-300" />
            </span>
            <span className="truncate rounded-md bg-white px-2 py-0.5 font-mono text-xs text-stone-500 ring-1 ring-stone-200">{address}</span>
            <span className="ms-auto text-xs text-stone-400">Preview</span>
          </div>
          <div className="h-[75dvh] overflow-y-auto" data-testid="website-preview">
            {resume.data ? (
              <PortfolioView
                cv={normalizeCV(resume.data.data)}
                ownerName={ownerName}
                theme={f.theme}
                accent={f.accent ?? resume.data.accent ?? "#1e4b8f"}
                content={f.content}
                showContactForm={f.showContactForm}
              />
            ) : (
              <p className="py-16 text-center text-sm text-stone-500">Loading preview…</p>
            )}
          </div>
        </div>
      </div>
      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
    </main>
  );
}

function Inbox({ unread }: { unread: number }) {
  const qc = useQueryClient();
  const messages = useQuery({ queryKey: ["portfolio", "messages", unread], queryFn: () => api.get<ContactMessageDto[]>("/portfolio/messages") });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["portfolio"] });
  };
  const read = useMutation({ mutationFn: (m: ContactMessageDto) => api.patch(`/portfolio/messages/${m.id}`, { read: !m.read }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/portfolio/messages/${id}`), onSuccess: refresh });
  const list = messages.data ?? [];
  return (
    <section id="inbox" className={`${card} flex flex-col gap-3 p-5`}>
      <h2 className="text-sm font-semibold text-stone-900">
        Messages {unread > 0 && <span className="ms-1 rounded-full bg-brand px-2 py-0.5 text-[11px] text-white">{unread} new</span>}
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-stone-500">Messages from your contact form show up here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-100">
          {list.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 py-3">
              <div className="flex items-center gap-2 text-sm">
                {!m.read && <span className="size-2 rounded-full bg-brand" aria-label="New" />}
                <span className="font-semibold text-stone-900">{m.name}</span>
                <a href={`mailto:${m.email}`} className="truncate text-brand hover:underline">
                  {m.email}
                </a>
                <span className="ms-auto shrink-0 text-xs text-stone-400">{new Date(m.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="whitespace-pre-line text-sm text-stone-700">{m.message}</p>
              <div className="flex gap-3 text-xs font-medium">
                <button type="button" className="text-stone-500 hover:underline" onClick={() => read.mutate(m)}>
                  Mark {m.read ? "unread" : "read"}
                </button>
                <button type="button" className="text-red-600 hover:underline" onClick={() => remove.mutate(m.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
