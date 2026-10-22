"use client";

import type { LinkAnalyticsDto, ShareLinkDto, UpdateShareLinkDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CopyIcon, DownloadIcon, LockIcon, TrashIcon } from "@cvb/ui";
import { api, isApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { keys, useShareLinks } from "@/lib/queries";
import type { Gate } from "@/lib/plans";
import { Dialog } from "./ui/Dialog";
import { btn, field, label } from "./ui/styles";

type Props = { resumeId: string; open: boolean; onClose: () => void; onUpgrade: (gate: Gate) => void };

/** Create and control the public links to a CV: on/off, address, password, expiry, QR code, who opened it. */
export function ShareDialog({ resumeId, open, onClose, onUpgrade }: Props) {
  const qc = useQueryClient();
  const links = useShareLinks(resumeId, open);
  const [error, setError] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: keys.shareLinks(resumeId) });

  const create = useMutation({
    mutationFn: () => api.post<ShareLinkDto>(`/resumes/${resumeId}/share-links`, {}),
    onSuccess: () => {
      track("share_link_created");
      void refresh();
    },
    onError: (e) => {
      if (isApiError(e, "PLAN_REQUIRED")) {
        onClose();
        onUpgrade({ kind: "feature", feature: "share.link" });
      } else setError(e.message);
    },
  });

  const [chosenId, setChosenId] = useState<string | null>(null);
  const list = links.data ?? [];
  const link = list.find((l) => l.id === chosenId) ?? list[0];

  return (
    <Dialog open={open} onClose={onClose} title="Share your CV" description="Anyone with the link can view and download it. No account needed." size="lg">
      {links.isLoading ? (
        <p className="py-6 text-center text-sm text-stone-500">Loading…</p>
      ) : link ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {list.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setChosenId(l.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${l.id === link.id ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300"}`}
              >
                {l.label || `/r/${l.slug}`} · {l.viewCount}
              </button>
            ))}
            <button type="button" className="rounded-full px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/10" disabled={create.isPending} onClick={() => create.mutate()}>
              + New link
            </button>
          </div>
          <p className="-mt-2 text-xs text-stone-500">Make a separate link for each employer to see who opened your CV.</p>
          <LinkEditor key={link.id} link={link} onChanged={refresh} onUpgrade={onUpgrade} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="max-w-sm text-sm text-stone-600">
            Get a link to your CV for applications, email signatures and your LinkedIn profile. It always shows the latest version.
          </p>
          <button type="button" className={btn.primary} disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create share link"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}

function LinkEditor({ link, onChanged, onUpgrade }: { link: ShareLinkDto; onChanged: () => void; onUpgrade: (gate: Gate) => void }) {
  const url = typeof window === "undefined" ? `/r/${link.slug}` : `${window.location.origin}/r/${link.slug}`;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [slug, setSlug] = useState(link.slug);
  const [password, setPassword] = useState("");
  const [expires, setExpires] = useState(link.expiresAt?.slice(0, 10) ?? "");
  const [linkLabel, setLinkLabel] = useState(link.label ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void import("qrcode").then((QR) =>
      QR.toDataURL(url, { margin: 1, width: 480, color: { dark: "#1c1917", light: "#ffffff" } }).then((d) => alive && setQr(d)),
    );
    return () => {
      alive = false;
    };
  }, [url]);

  const save = useMutation({
    mutationFn: (patch: UpdateShareLinkDto) => api.patch<ShareLinkDto>(`/share-links/${link.id}`, patch),
    onSuccess: () => {
      setError("");
      setPassword("");
      onChanged();
    },
    onError: (e) => setError(e.message),
  });
  const remove = useMutation({ mutationFn: () => api.delete(`/share-links/${link.id}`), onSuccess: onChanged });

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-800">Link is {link.enabled ? "on" : "off"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={link.enabled}
              aria-label="Link on or off"
              onClick={() => save.mutate({ enabled: !link.enabled })}
              className={`relative h-6 w-11 rounded-full transition ${link.enabled ? "bg-emerald-500" : "bg-stone-300"}`}
            >
              <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${link.enabled ? "start-[22px]" : "start-0.5"}`} />
            </button>
          </div>
          <div className="flex gap-2">
            <input readOnly value={url} className={`${field} font-mono text-xs ${link.enabled ? "" : "opacity-50"}`} onFocus={(e) => e.target.select()} />
            <button type="button" className={btn.secondary} onClick={() => void copy()}>
              <CopyIcon className="size-4" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-stone-500">
            Viewed {link.viewCount} {link.viewCount === 1 ? "time" : "times"}
            {link.lastViewedAt && <> · last {new Date(link.lastViewedAt).toLocaleString()}</>}
            {link.hasPassword && (
              <span className="ms-2 inline-flex items-center gap-1 text-stone-600">
                <LockIcon className="size-3" /> Password protected
              </span>
            )}
          </p>
        </div>
        {qr && (
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimise */}
            <img src={qr} alt={`QR code for ${url}`} className="size-28 rounded-lg ring-1 ring-stone-200" />
            <a href={qr} download={`${link.slug}-qr.png`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              <DownloadIcon className="size-3.5" /> QR code
            </a>
          </div>
        )}
      </div>

      <form
        className="grid gap-4 border-t border-stone-100 pt-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const patch: UpdateShareLinkDto = {};
          if (slug.trim() && slug.trim() !== link.slug) patch.slug = slug.trim();
          if (password) patch.password = password;
          if (linkLabel.trim() !== (link.label ?? "")) patch.label = linkLabel.trim() || null;
          if (expires !== (link.expiresAt?.slice(0, 10) ?? "")) {
            patch.expiresAt = expires ? new Date(`${expires}T23:59:59`).toISOString() : null;
          }
          if (Object.keys(patch).length) save.mutate(patch);
        }}
      >
        <div>
          <label className={label} htmlFor="share-label">
            Who it&apos;s for (optional)
          </label>
          <input id="share-label" className={field} value={linkLabel} maxLength={80} placeholder="e.g. Acme application" onChange={(e) => setLinkLabel(e.target.value)} />
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-stone-700">
            <input type="checkbox" className="size-4 accent-brand" checked={link.notifyOnView} onChange={(e) => save.mutate({ notifyOnView: e.target.checked })} />
            Email me when it&apos;s opened
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="share-slug">
            Link address
          </label>
          <div className="flex items-center gap-1 text-sm text-stone-500">
            <span className="shrink-0">/r/</span>
            <input id="share-slug" className={field} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="share-password">
            {link.hasPassword ? "New password" : "Password (optional)"}
          </label>
          <input
            id="share-password"
            type="password"
            autoComplete="new-password"
            minLength={4}
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={link.hasPassword ? "Leave empty to keep" : "At least 4 characters"}
          />
          {link.hasPassword && (
            <button type="button" className="mt-1 text-xs font-medium text-brand hover:underline" onClick={() => save.mutate({ password: null })}>
              Remove password
            </button>
          )}
        </div>
        <div>
          <label className={label} htmlFor="share-expiry">
            Expires on (optional)
          </label>
          <input id="share-expiry" type="date" className={field} value={expires} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpires(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="flex items-center justify-between sm:col-span-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
            onClick={() => window.confirm("Delete this link? Anyone who has it will no longer be able to open your CV.") && remove.mutate()}
          >
            <TrashIcon className="size-4" /> Delete link
          </button>
          <button type="submit" className={btn.primary} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      <LinkAnalytics linkId={link.id} views={link.viewCount} onUpgrade={onUpgrade} />
    </div>
  );
}

type Analytics = LinkAnalyticsDto & { complete: boolean };

/** Views per day, viewers, time on page, downloads, referrers and devices (full report on Premium). */
function LinkAnalytics({ linkId, views, onUpgrade }: { linkId: string; views: number; onUpgrade: (gate: Gate) => void }) {
  const data = useQuery({ queryKey: ["share-links", linkId, "analytics", views], queryFn: () => api.get<Analytics>(`/share-links/${linkId}/analytics`) });
  const a = data.data;
  if (!a) return null;
  const max = Math.max(1, ...a.daily.map((d) => d.views));
  const row = (title: string, items: { name: string; views: number }[]) =>
    items.length > 0 && (
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h4>
        <ul className="text-sm text-stone-700">
          {items.slice(0, 5).map((i) => (
            <li key={i.name} className="flex justify-between gap-2">
              <span className="truncate">{i.name}</span>
              <span className="tabular-nums text-stone-500">{i.views}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <section className="border-t border-stone-100 pt-4" aria-label="Link analytics">
      <h3 className="text-sm font-semibold text-stone-900">Last 30 days</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Views", a.views],
          ["Viewers", a.uniqueViewers],
          ["Avg. time", a.complete ? `${a.avgSeconds}s` : "—"],
          ["Downloads", a.complete ? a.downloads : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-stone-50 px-3 py-2 ring-1 ring-stone-200">
            <div className="text-[11px] font-medium text-stone-500">{k}</div>
            <div className="text-lg font-semibold tabular-nums text-stone-900">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-16 items-end gap-[2px]" role="img" aria-label={`Views per day: ${a.daily.map((d) => d.views).join(", ")}`}>
        {a.daily.map((d) => (
          <div key={d.date} title={`${d.date}: ${d.views}`} className="flex-1 rounded-t-sm bg-brand/70" style={{ height: `${Math.max(4, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.2 }} />
        ))}
      </div>
      {a.complete ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {row("Referrers", a.referrers.map((r) => ({ name: r.referrer, views: r.views })))}
          {row("Countries", a.countries.map((r) => ({ name: r.country, views: r.views })))}
          {row("Devices", a.devices.map((r) => ({ name: r.device, views: r.views })))}
        </div>
      ) : (
        <button type="button" className="mt-3 text-sm font-medium text-brand hover:underline" onClick={() => onUpgrade({ kind: "feature", feature: "share.analytics" })}>
          See time on page, downloads, referrers and devices with Premium →
        </button>
      )}
    </section>
  );
}
