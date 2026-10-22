"use client";

import type { OrgDto, TalentContactResultDto, TalentDetailDto, TalentResultDto } from "@cvb/contracts";
import { TALENT_LIMITS, type CV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { isTemplateId } from "@cvb/templates/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, Drawer, EmptyState, SearchField, Skeleton, TextArea, TextField } from "@cvb/ui";
import { api } from "@/lib/api";
import { useTalentContacts, useTalentDetail, useTalentSearch, type TalentFilters } from "@/lib/talent";

const EMPTY: TalentFilters = { q: "", location: "", role: "" };
const date = (iso: string) => new Date(iso).toLocaleDateString();
const DAY = 24 * 3600 * 1000;

/**
 * Agencies: search people who chose to be found, read what they shared and write to them.
 * Messages go out by email from the platform; the candidate's address stays private.
 */
export function TalentTab({ org }: { org: OrgDto }) {
  const [draft, setDraft] = useState<TalentFilters>(EMPTY);
  const [filters, setFilters] = useState<TalentFilters>(EMPTY);
  const [open, setOpen] = useState<string | null>(null);
  const search = useTalentSearch(org.id, filters);
  const pages = search.data?.pages ?? [];
  const rows = pages.flatMap((p) => p.items);
  const left = pages.at(-1)?.contactsLeft;
  const filtered = Boolean(filters.q || filters.location || filters.role);

  function submit(e: FormEvent) {
    e.preventDefault();
    setFilters({ q: draft.q.trim(), location: draft.location.trim(), role: draft.role.trim() });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Find talent"
        description="Only people who turned on “Let recruiters find me” appear here, showing what they chose to share."
      >
        <form onSubmit={submit} className="flex flex-col gap-3" role="search" aria-label="Search talent">
          <SearchField
            label="Job title or skills"
            placeholder="Job title or skills, e.g. React developer"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField
              label="Location"
              placeholder="Any"
              icon="map-pin"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
            <TextField
              label="Open to the role"
              placeholder="Any"
              icon="briefcase"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
            <Button type="submit" variant="primary" icon="search" loading={search.isFetching && !search.isFetchingNextPage}>
              Search
            </Button>
          </div>
        </form>
      </Card>

      {search.error ? (
        <Alert tone="danger">{search.error.message}</Alert>
      ) : !search.data ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton height={112} shape="block" />
          <Skeleton height={112} shape="block" />
        </div>
      ) : (
        <section aria-labelledby="talent-results" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="talent-results" className="cvb-h3">
              {rows.length === 0 ? "No one yet" : filtered ? "Matching people" : "Recently updated"}
            </h2>
            {left !== undefined && (
              <span className="cvb-caption">
                You can send <span className="tabular-nums">{left}</span> more {left === 1 ? "message" : "messages"} in the next 24 hours.
              </span>
            )}
          </div>
          {rows.length === 0 ? (
            <Card>
              <EmptyState icon="users" title={filtered ? "No one matches that search" : "No one is open to recruiters yet"} size="sm">
                <p>{filtered ? "Try fewer keywords or another place." : "People appear here as soon as they choose to be found."}</p>
              </EmptyState>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.id}>
                  <ResultCard result={r} onOpen={() => setOpen(r.id)} />
                </li>
              ))}
            </ul>
          )}
          {search.hasNextPage && (
            <Button className="self-center" loading={search.isFetchingNextPage} onClick={() => void search.fetchNextPage()}>
              Show more
            </Button>
          )}
        </section>
      )}

      <ContactLog orgId={org.id} />
      <ProfileDrawer org={org} id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function ResultCard({ result: r, onOpen }: { result: TalentResultDto; onOpen: () => void }) {
  return (
    <article className="cvb-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cvb-h3 min-w-0 break-words">{r.headline}</h3>
          <Badge tone={r.share === "full" ? "brand" : "neutral"}>{r.share === "full" ? "Full CV" : "Summary"}</Badge>
        </div>
        <p className="cvb-caption">
          {r.location || "Location not given"} · updated {date(r.updatedAt)}
        </p>
        {r.skills.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Top skills">
            {r.skills.map((s) => (
              <li key={s} className="rounded-sm bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                {s}
              </li>
            ))}
          </ul>
        )}
        {r.roles.length > 0 && <p className="text-sm text-ink-2">Open to: {r.roles.join(", ")}</p>}
      </div>
      <Button className="shrink-0 self-start" iconEnd="arrow-right" onClick={onOpen} aria-label={`View ${r.headline}`}>
        View
      </Button>
    </article>
  );
}

function ProfileDrawer({ org, id, onClose }: { org: OrgDto; id: string | null; onClose: () => void }) {
  const detail = useTalentDetail(org.id, id);
  const d = detail.data;
  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={d?.headline ?? "Profile"}
      description={d ? `${d.location || "Location not given"} · CV updated ${date(d.updatedAt)}` : undefined}
    >
      {detail.error ? (
        <Alert tone="danger">{detail.error.message}</Alert>
      ) : !d ? (
        <Skeleton height={420} shape="block" />
      ) : (
        <div className="flex flex-col gap-5">
          {d.roles.length > 0 && <p className="text-sm text-ink-2">Open to: {d.roles.join(", ")}</p>}
          <p className="cvb-caption">
            {d.share === "full"
              ? "They chose to share their full CV."
              : "They chose to share a summary: contact details, links and personal details are left out."}
          </p>
          <ContactForm org={org} profile={d} key={d.id} />
          <ReadOnlyCV cv={d.cv} template={d.templateId} accent={d.accent} />
        </div>
      )}
    </Drawer>
  );
}

function ContactForm({ org, profile }: { org: OrgDto; profile: TalentDetailDto }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [openedAt] = useState(() => Date.now());
  const send = useMutation({
    mutationFn: () => api.post<TalentContactResultDto>(`/orgs/${org.id}/talent/${profile.id}/contact`, { message }),
    onSuccess: () => {
      setMessage("");
      void qc.invalidateQueries({ queryKey: ["orgs", org.id, "talent"] });
    },
  });
  const tooShort = message.trim().length < 20;

  if (send.isSuccess) {
    return (
      <Alert tone="success" title="Message sent">
        We emailed it to them. If they&apos;re interested, they&apos;ll reply to your email address.
      </Alert>
    );
  }
  const last = profile.lastContactedAt;
  if (last && openedAt - new Date(last).getTime() < TALENT_LIMITS.repeatContactDays * DAY) {
    return (
      <Alert>
        Someone at {org.name} wrote to them on {date(last)}. You can write again {TALENT_LIMITS.repeatContactDays} days after
        that.
      </Alert>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooShort) send.mutate();
      }}
    >
      <TextArea
        label="Write to them"
        hint={`We email this with your name, ${org.name} and your email address so they can reply. Their email stays private unless they do.`}
        rows={5}
        maxLength={2000}
        showCount
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Say who you are, the role and why you think it fits."
      />
      {send.error && <Alert tone="danger">{send.error.message}</Alert>}
      <div>
        <Button type="submit" variant="primary" icon="mail" loading={send.isPending} disabled={tooShort}>
          Send message
        </Button>
      </div>
    </form>
  );
}

/** The shared CV at the width of the drawer, every page. */
function ReadOnlyCV({ cv, template, accent }: { cv: CV; template: string; accent: string | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0, height: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      if (!wrap.current || !paper.current) return;
      const scale = wrap.current.clientWidth / paper.current.offsetWidth;
      setBox({ scale, height: paper.current.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    if (paper.current) ro.observe(paper.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={wrap}
      dir="ltr"
      aria-label="Shared CV"
      className="relative w-full overflow-hidden rounded-md border border-line bg-paper"
      style={{ height: box.height || 480 }}
    >
      <div className="absolute start-0 top-0 origin-top-left" style={{ transform: `scale(${box.scale})`, visibility: box.scale ? "visible" : "hidden" }}>
        <div ref={paper} className="paper !shadow-none" data-size="a4">
          <CVDocument cv={cv} template={isTemplateId(template) ? template : "classic"} accent={accent} />
        </div>
      </div>
    </div>
  );
}

function ContactLog({ orgId }: { orgId: string }) {
  const log = useTalentContacts(orgId);
  const rows = log.data ?? [];
  if (!rows.length) return null;
  return (
    <Card title="Messages sent" description="Everyone your organisation wrote to through talent search.">
      <ul className="flex flex-col divide-y divide-line">
        {rows.slice(0, 50).map((c) => (
          <li key={c.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm text-ink">{c.headline}</span>
              <span className="cvb-caption">
                {c.senderName} · {date(c.createdAt)}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-ink-2">{c.message}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
