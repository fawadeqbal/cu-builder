"use client";

import type { ContactMessageDto, MyPortfolioDto, PortfolioDto, SavePortfolioDto } from "@cvb/contracts";
import { normalizeCV, siteSlugProblem } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  TextArea,
  TextField,
} from "@cvb/ui";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { useResume, useResumes } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { DomainSetup } from "../branding/DomainSetup";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
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
        <div className="min-h-dvh bg-canvas">
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
  if (mine.isLoading || resumes.isLoading)
    return (
      <main className="mx-auto grid w-full max-w-(--layout-xl) gap-6 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[28rem_1fr]">
        <div className="flex flex-col gap-4">
          <Skeleton width={200} height={34} />
          <Skeleton height={360} shape="block" />
        </div>
        <Skeleton height={560} shape="block" />
      </main>
    );
  if (!mine.data)
    return (
      <main className="mx-auto w-full max-w-(--layout-sm) px-4 pb-20 pt-10 sm:px-6">
        <Alert tone="danger">{mine.error?.message ?? "Couldn't load your website"}</Alert>
      </main>
    );
  const first = resumes.data?.items[0]?.id;
  if (!mine.data.site && !first) {
    return (
      <main className="mx-auto w-full max-w-(--layout-sm) px-4 pb-20 pt-10 sm:px-6">
        <div className="cvb-card">
          <EmptyState
            icon="globe"
            title="Your website"
            actions={
              <Button variant="primary" href="/app">
                Go to My CVs
              </Button>
            }
          >
            <p>Create a CV first; your website is built from it.</p>
          </EmptyState>
        </div>
      </main>
    );
  }
  const site = mine.data.site;
  const initial: SavePortfolioDto = site
    ? {
        resumeId: site.resumeId,
        slug: site.slug,
        theme: site.theme,
        accent: site.accent,
        showContactForm: site.showContactForm,
        published: site.published,
        content: site.content,
      }
    : {
        resumeId: first!,
        slug: mine.data.suggestedSlug,
        theme: "minimal",
        accent: null,
        showContactForm: true,
        published: false,
        content: { about: "", projects: [] },
      };
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
  const address = data.portfolioDomain
    ? `${f.slug}.${data.portfolioDomain}`
    : `${typeof window === "undefined" ? "" : window.location.host}/p/${f.slug}`;

  const save = useMutation({
    mutationFn: (next: SavePortfolioDto) => api.put<PortfolioDto>("/portfolio", next),
    onSuccess: (s) => qc.setQueryData<MyPortfolioDto>(KEY, (d) => d && { ...d, site: s }),
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/portfolio"),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const setSite = (s: PortfolioDto) => qc.setQueryData<MyPortfolioDto>(KEY, (d) => d && { ...d, site: s });

  const set = <K extends keyof SavePortfolioDto>(k: K, v: SavePortfolioDto[K]) => setF((x) => ({ ...x, [k]: v }));
  const projects = f.content.projects;
  const setProjects = (p: typeof projects) => set("content", { ...f.content, projects: p });
  const dirty = JSON.stringify(f) !== JSON.stringify(initial) || !site;
  const theme = THEMES.find((t) => t.id === f.theme);

  return (
    <main className="mx-auto grid w-full max-w-(--layout-xl) items-start gap-6 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[28rem_1fr]">
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader
          title="My website"
          description="A personal site built from your CV. It updates when your CV does."
          actions={
            site?.published && (
              <Button href={site.url} target="_blank" rel="noreferrer noopener" iconEnd="external-link">
                View
              </Button>
            )
          }
        />

        <Card title="Site">
          <TextField
            id="w-slug"
            dir="ltr"
            label="Address"
            value={f.slug}
            maxLength={40}
            error={slugProblem ?? undefined}
            hint={slugProblem ? undefined : <span dir="ltr">{address}</span>}
            onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          />
          <Select
            id="w-cv"
            label="Built from"
            value={f.resumeId}
            onChange={(e) => set("resumeId", e.target.value)}
            options={resumes.data?.items.map((r) => ({ value: r.id, label: r.title })) ?? []}
          />
          <div className="cvb-field">
            <span className="cvb-label" id="w-look">
              Look
            </span>
            <SegmentedControl<PortfolioTheme>
              label="Look"
              block
              value={f.theme}
              onChange={(v) => set("theme", v)}
              options={THEMES.map((t) => ({ value: t.id, label: t.name }))}
            />
            {theme && <span className="cvb-hint">{theme.hint}</span>}
          </div>
          <div className="cvb-field">
            <label className="cvb-label" htmlFor="w-accent">
              Colour
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {/* A colour picker: the value is the person's chosen site colour (data). */}
              <input
                id="w-accent"
                type="color"
                className="h-10 w-12 cursor-pointer rounded-md border border-line-control bg-surface p-1"
                value={f.accent ?? resume.data?.accent ?? "#1e4b8f"}
                onChange={(e) => set("accent", e.target.value)}
              />
              {f.accent && (
                <Button variant="link" size="sm" onClick={() => set("accent", null)}>
                  Use the CV&apos;s colour
                </Button>
              )}
            </div>
          </div>
          <TextArea
            id="w-about"
            label="About"
            optional
            rows={4}
            maxLength={4000}
            placeholder="Leave empty to use your CV summary"
            value={f.content.about}
            onChange={(e) => set("content", { ...f.content, about: e.target.value })}
          />
        </Card>

        <Card
          title="Extra projects"
          description="Projects from your CV are shown too. Add work samples with a link and an image."
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon="plus"
              disabled={projects.length >= 12}
              onClick={() => setProjects([...projects, { title: "", description: "", url: "", imageUrl: "" }])}
            >
              Add
            </Button>
          }
        >
          {projects.length === 0 && <p className="text-ink-3">No extra projects yet.</p>}
          {projects.map((p, i) => {
            const patch = (v: Partial<typeof p>) => setProjects(projects.map((x, j) => (j === i ? { ...x, ...v } : x)));
            return (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-line p-3">
                <div className="flex gap-2">
                  <TextField
                    aria-label="Project title"
                    className="min-w-0 flex-1"
                    placeholder="Title"
                    value={p.title}
                    maxLength={120}
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                  <IconButton
                    icon="trash"
                    label="Remove project"
                    onClick={() => setProjects(projects.filter((_, j) => j !== i))}
                  />
                </div>
                <TextArea
                  aria-label="Project description"
                  rows={2}
                  placeholder="What it is and your part in it"
                  value={p.description}
                  maxLength={1200}
                  onChange={(e) => patch({ description: e.target.value })}
                />
                <TextField
                  aria-label="Project link"
                  icon="link"
                  placeholder="https://… (link)"
                  value={p.url}
                  onChange={(e) => patch({ url: e.target.value.trim() })}
                />
                <TextField
                  aria-label="Image link"
                  icon="file"
                  placeholder="https://… (image)"
                  value={p.imageUrl}
                  onChange={(e) => patch({ imageUrl: e.target.value.trim() })}
                />
              </div>
            );
          })}
        </Card>

        <Card
          title="Publishing"
          footer={
            <>
              {site && (
                <Button
                  variant="ghost"
                  icon="trash"
                  className="me-auto"
                  onClick={() => window.confirm("Delete your website and its messages?") && remove.mutate()}
                >
                  Delete site
                </Button>
              )}
              <Button
                variant="primary"
                loading={save.isPending}
                disabled={Boolean(slugProblem) || !dirty}
                onClick={() => save.mutate(f)}
              >
                {save.isPending ? "Saving…" : site ? "Save changes" : "Create website"}
              </Button>
            </>
          }
        >
          <Switch
            label="Contact form (messages come to your inbox and email)"
            checked={f.showContactForm}
            onChange={(on) => set("showContactForm", on)}
            className="text-start"
          />
          <Switch
            label="Published (anyone with the address can see it)"
            checked={f.published}
            onChange={(on) => set("published", on)}
            className="text-start"
          />
          {save.error && <Alert tone="danger">{save.error.message}</Alert>}
          {site && (
            <p className="cvb-caption flex flex-wrap items-center gap-x-1">
              <span className="tabular-nums">{site.viewCount}</span> {site.viewCount === 1 ? "visit" : "visits"} ·{" "}
              {site.published ? (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-brand-ink hover:underline"
                  dir="ltr"
                >
                  {site.url.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "not published"
              )}
            </p>
          )}
        </Card>

        {site && (
          <Card title="Your own domain">
            {data.canUseCustomDomain ? (
              <DomainSetup
                status={site.customDomain}
                example="sara.dev"
                onSave={async (domain) => setSite(await api.put<PortfolioDto>("/portfolio/domain", { domain }))}
                onVerify={async () => setSite(await api.post<PortfolioDto>("/portfolio/domain/verify"))}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-ink-2">Use a domain like yourname.com on a paid plan.</p>
                <Button
                  variant="highlight"
                  icon="sparkle"
                  onClick={() => setGate({ kind: "feature", feature: "portfolio.customDomain" })}
                >
                  Upgrade
                </Button>
              </div>
            )}
          </Card>
        )}

        {site && <Inbox unread={site.unreadMessages} />}
      </div>

      <div className="min-w-0 lg:sticky lg:top-6">
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
            <span className="flex gap-1" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
            </span>
            <span
              className="min-w-0 truncate rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs text-ink-3"
              dir="ltr"
            >
              {address}
            </span>
            <span className="cvb-overline ms-auto shrink-0">Preview</span>
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
              <div className="flex flex-col gap-3 p-6">
                <Skeleton width="50%" height={28} />
                <Skeleton width="70%" />
                <Skeleton height={200} shape="block" />
              </div>
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
  const messages = useQuery({
    queryKey: ["portfolio", "messages", unread],
    queryFn: () => api.get<ContactMessageDto[]>("/portfolio/messages"),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["portfolio"] });
  };
  const read = useMutation({
    mutationFn: (m: ContactMessageDto) => api.patch(`/portfolio/messages/${m.id}`, { read: !m.read }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/portfolio/messages/${id}`),
    onSuccess: refresh,
  });
  const list = messages.data ?? [];
  return (
    <Card
      id="inbox"
      title={
        <span className="flex items-center gap-2">
          Messages
          {unread > 0 && (
            <Badge tone="brand" pill>
              {unread} new
            </Badge>
          )}
        </span>
      }
    >
      {list.length === 0 ? (
        <p className="text-ink-3">Messages from your contact form show up here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {list.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {!m.read && <Badge tone="brand">New</Badge>}
                <span className="font-semibold text-ink">{m.name}</span>
                <a href={`mailto:${m.email}`} className="min-w-0 truncate text-brand-ink hover:underline" dir="ltr">
                  {m.email}
                </a>
                <span className="cvb-caption ms-auto shrink-0">{new Date(m.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="whitespace-pre-line text-ink-2">{m.message}</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => read.mutate(m)}>
                  Mark {m.read ? "unread" : "read"}
                </Button>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => remove.mutate(m.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
