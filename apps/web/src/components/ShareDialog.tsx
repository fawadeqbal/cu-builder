"use client";

import type { LinkAnalyticsDto, ShareLinkDto, UpdateShareLinkDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Checkbox, Chip, Spinner, StatTile, Switch, TextField } from "@cvb/ui";
import { api, isApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { keys, useShareLinks } from "@/lib/queries";
import type { Gate } from "@/lib/plans";
import { Dialog } from "./ui/Dialog";

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
    <Dialog
      open={open}
      onClose={onClose}
      title="Share your CV"
      description="Anyone with the link can view and download it. No account needed."
      size="lg"
    >
      {links.isLoading ? (
        <div className="grid place-items-center py-8">
          <Spinner />
        </div>
      ) : link ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {list.map((l) => (
                <Chip key={l.id} selected={l.id === link.id} onClick={() => setChosenId(l.id)}>
                  <span>
                    {l.label || `/r/${l.slug}`} · <span className="cvb-num">{l.viewCount}</span>
                  </span>
                </Chip>
              ))}
              <Button variant="ghost" size="sm" icon="plus" disabled={create.isPending} onClick={() => create.mutate()}>
                New link
              </Button>
            </div>
            <p className="cvb-caption text-ink-3">Make a separate link for each employer to see who opened your CV.</p>
          </div>
          <LinkEditor key={link.id} link={link} onChanged={refresh} onUpgrade={onUpgrade} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="max-w-sm text-sm text-ink-2">
            Get a link to your CV for applications, email signatures and your LinkedIn profile. It always shows the
            latest version.
          </p>
          <Button variant="primary" icon="link" loading={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create share link"}
          </Button>
          {error && (
            <Alert tone="danger" className="w-full text-start">
              {error}
            </Alert>
          )}
        </div>
      )}
    </Dialog>
  );
}

function LinkEditor({
  link,
  onChanged,
  onUpgrade,
}: {
  link: ShareLinkDto;
  onChanged: () => void;
  onUpgrade: (gate: Gate) => void;
}) {
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
      QR.toDataURL(url, { margin: 1, width: 480, color: { dark: "#1c1917", light: "#ffffff" } }).then(
        (d) => alive && setQr(d),
      ),
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
          <Switch
            label={`Link is ${link.enabled ? "on" : "off"}`}
            aria-label="Link on or off"
            checked={link.enabled}
            onChange={() => save.mutate({ enabled: !link.enabled })}
            className="font-medium"
          />
          <div className="flex items-end gap-2">
            <TextField
              label="Link"
              readOnly
              value={url}
              dir="ltr"
              className={`min-w-0 flex-1 ${link.enabled ? "" : "opacity-60"}`}
              inputClassName="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button icon={copied ? "check" : "copy"} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="cvb-caption flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-3">
            <span>
              Viewed <span className="cvb-num">{link.viewCount}</span> {link.viewCount === 1 ? "time" : "times"}
              {link.lastViewedAt && <> · last {new Date(link.lastViewedAt).toLocaleString()}</>}
            </span>
            {link.hasPassword && <Badge icon="lock">Password protected</Badge>}
          </p>
        </div>
        {qr && (
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimise */}
            <img src={qr} alt={`QR code for ${url}`} className="size-28 rounded-md border border-line bg-paper" />
            <Button variant="link" size="sm" icon="download" href={qr} download={`${link.slug}-qr.png`}>
              QR code
            </Button>
          </div>
        )}
      </div>

      <form
        className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2"
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
        <TextField
          id="share-label"
          label="Who it's for"
          optional
          value={linkLabel}
          maxLength={80}
          placeholder="e.g. Acme application"
          onChange={(e) => setLinkLabel(e.target.value)}
        />
        <div className="flex items-end pb-2">
          <Checkbox
            label="Email me when it's opened"
            checked={link.notifyOnView}
            onChange={(e) => save.mutate({ notifyOnView: e.target.checked })}
          />
        </div>
        <TextField
          id="share-slug"
          label="Link address"
          className="sm:col-span-2"
          prefix="/r/"
          dir="ltr"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
        />
        <div className="flex flex-col gap-1">
          <TextField
            id="share-password"
            label={link.hasPassword ? "New password" : "Password"}
            optional={!link.hasPassword}
            type="password"
            autoComplete="new-password"
            minLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={link.hasPassword ? "Leave empty to keep" : "At least 4 characters"}
          />
          {link.hasPassword && (
            <Button variant="link" size="sm" className="self-start" onClick={() => save.mutate({ password: null })}>
              Remove password
            </Button>
          )}
        </div>
        <TextField
          id="share-expiry"
          label="Expires on"
          optional
          type="date"
          value={expires}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setExpires(e.target.value)}
        />
        {error && (
          <Alert tone="danger" className="sm:col-span-2">
            {error}
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <Button
            variant="ghost"
            icon="trash"
            className="text-danger hover:text-danger"
            onClick={() =>
              window.confirm("Delete this link? Anyone who has it will no longer be able to open your CV.") &&
              remove.mutate()
            }
          >
            Delete link
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
      <LinkAnalytics linkId={link.id} views={link.viewCount} onUpgrade={onUpgrade} />
    </div>
  );
}

type Analytics = LinkAnalyticsDto & { complete: boolean };

/** Views per day, viewers, time on page, downloads, referrers and devices (full report on Premium). */
function LinkAnalytics({
  linkId,
  views,
  onUpgrade,
}: {
  linkId: string;
  views: number;
  onUpgrade: (gate: Gate) => void;
}) {
  const data = useQuery({
    queryKey: ["share-links", linkId, "analytics", views],
    queryFn: () => api.get<Analytics>(`/share-links/${linkId}/analytics`),
  });
  const a = data.data;
  if (!a) return null;
  const max = Math.max(1, ...a.daily.map((d) => d.views));
  const first = a.daily[0]?.date;
  const last = a.daily[a.daily.length - 1]?.date;
  const row = (title: string, items: { name: string; views: number }[]) =>
    items.length > 0 && (
      <div className="flex flex-col gap-1.5">
        <h4 className="cvb-overline text-ink-3">{title}</h4>
        <ul className="flex flex-col gap-1 text-sm text-ink-2">
          {items.slice(0, 5).map((i) => (
            <li key={i.name} className="flex justify-between gap-2">
              <span className="truncate">{i.name}</span>
              <span className="cvb-num text-ink-3">{i.views}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4" aria-label="Link analytics">
      <h3 className="cvb-h3">Last 30 days</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Views" value={a.views} hint="last 30 days" />
        <StatTile label="Viewers" value={a.uniqueViewers} hint="unique" />
        <StatTile label="Avg. time" value={a.complete ? `${a.avgSeconds}s` : "—"} hint="per view" />
        <StatTile label="Downloads" value={a.complete ? a.downloads : "—"} hint="PDF" />
      </div>
      <figure className="flex flex-col gap-1">
        <div
          className="flex h-20 items-end gap-[2px] border-b border-line-strong"
          role="img"
          aria-label={`Views per day: ${a.daily.map((d) => d.views).join(", ")}`}
        >
          {a.daily.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.views}`}
              className={`flex-1 rounded-t-[2px] ${d.views ? "bg-brand" : "bg-surface-3"}`}
              style={{ height: d.views ? `${Math.max(6, (d.views / max) * 100)}%` : "2px" }}
            />
          ))}
        </div>
        {first && last && (
          <figcaption className="cvb-caption flex justify-between font-mono text-ink-3" dir="ltr">
            <span>{first}</span>
            <span>{last}</span>
          </figcaption>
        )}
      </figure>
      {a.complete ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {row(
            "Referrers",
            a.referrers.map((r) => ({ name: r.referrer, views: r.views })),
          )}
          {row(
            "Countries",
            a.countries.map((r) => ({ name: r.country, views: r.views })),
          )}
          {row(
            "Devices",
            a.devices.map((r) => ({ name: r.device, views: r.views })),
          )}
        </div>
      ) : (
        <Button
          variant="link"
          icon="sparkle"
          iconEnd="arrow-right"
          className="self-start"
          onClick={() => onUpgrade({ kind: "feature", feature: "share.analytics" })}
        >
          See time on page, downloads, referrers and devices with Premium
        </Button>
      )}
    </section>
  );
}
