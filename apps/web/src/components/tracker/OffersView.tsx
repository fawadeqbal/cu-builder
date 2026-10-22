"use client";

import type { ApplicationDto, MeDto } from "@cvb/contracts";
import { NEGOTIATION_TEMPLATES, compareOffers, fillTemplate, totalComp } from "@cvb/domain";
import { useState, type ReactNode } from "react";
import { CopyIcon } from "@cvb/ui";
import { btn, card, field, label } from "../ui/styles";

const fmt = (n: number | null, currency: string) => (n === null ? "—" : `${currency ? `${currency} ` : ""}${n.toLocaleString()}`);
const REMOTE: Record<string, string> = { onsite: "On site", hybrid: "Hybrid", remote: "Remote", "": "—" };

/** Offers side by side (total compensation, growth, deadline) and polite negotiation templates. */
export function OffersView({ apps, me, onOpen }: { apps: ApplicationDto[]; me: MeDto; onOpen: (id: string) => void }) {
  const offers = apps.filter((a) => a.offer).map((a) => ({ ...a, offer: a.offer! }));
  const best = compareOffers(offers);
  const [templateId, setTemplateId] = useState(NEGOTIATION_TEMPLATES[0]!.id);
  const [appId, setAppId] = useState(offers[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState(false);
  const template = NEGOTIATION_TEMPLATES.find((t) => t.id === templateId)!;
  const app = offers.find((o) => o.id === appId) ?? offers[0];
  const values = {
    role: app?.job.title,
    company: app?.job.company,
    contact: app?.contacts[0]?.name,
    name: me.name,
    target,
    deadline: app?.offer.deadline ? new Date(app.offer.deadline).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : undefined,
  };
  const text = `Subject: ${fillTemplate(template.subject, values)}\n\n${fillTemplate(template.body, values)}`;

  return (
    <div className="flex flex-col gap-6">
      <section className={`${card} overflow-hidden`}>
        <h2 className="border-b border-stone-100 px-4 py-3 text-base font-semibold text-stone-900">Compare offers</h2>
        {offers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500">Open an application and add its offer details (Offer tab) to compare them here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5" />
                  {offers.map((o) => (
                    <th key={o.id} className="px-4 py-2.5 normal-case">
                      <button type="button" className="text-left text-sm font-semibold text-stone-900 hover:underline" onClick={() => onOpen(o.id)}>
                        {o.job.company || o.job.title}
                      </button>
                      <div className="text-xs font-normal text-stone-500">{o.job.title}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(
                  [
                    ["Base salary", (o) => fmt(o.offer.baseSalary, o.offer.currency)],
                    ["Bonus", (o) => fmt(o.offer.bonus, o.offer.currency)],
                    ["Equity / year", (o) => fmt(o.offer.equity, o.offer.currency)],
                    ["Total", (o) => <strong className={best.bestTotal === o.id ? "text-emerald-700" : ""}>{fmt(totalComp(o.offer), o.offer.currency)}{best.bestTotal === o.id ? " · highest" : ""}</strong>],
                    ["Work", (o) => REMOTE[o.offer.remote] ?? "—"],
                    ["Location", (o) => o.offer.location || "—"],
                    ["Growth", (o) => (o.offer.growth ? <span className={best.bestGrowth === o.id ? "font-semibold text-emerald-700" : ""}>{"★".repeat(o.offer.growth)}{"☆".repeat(5 - o.offer.growth)}</span> : "—")],
                    ["Benefits", (o) => <span className="whitespace-pre-line">{o.offer.benefits || "—"}</span>],
                    ["Answer by", (o) => (o.offer.deadline ? new Date(o.offer.deadline).toLocaleDateString() : "—")],
                  ] as [string, (o: (typeof offers)[number]) => ReactNode][]
                ).map(([name, cell]) => (
                  <tr key={name}>
                    <th scope="row" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {name}
                    </th>
                    {offers.map((o) => (
                      <td key={o.id} className="px-4 py-2.5 align-top text-stone-700">
                        {cell(o)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-stone-500">Totals add base, bonus and yearly equity value in each offer&apos;s own currency.</p>
          </div>
        )}
      </section>

      <section className={`${card} grid gap-4 p-5 lg:grid-cols-[18rem_1fr]`}>
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-stone-900">Negotiation templates</h2>
          <div>
            <label className={label} htmlFor="n-template">
              Situation
            </label>
            <select id="n-template" className={field} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {NEGOTIATION_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">{template.when}</p>
          </div>
          {offers.length > 0 && (
            <div>
              <label className={label} htmlFor="n-offer">
                Offer
              </label>
              <select id="n-offer" className={field} value={app?.id ?? ""} onChange={(e) => setAppId(e.target.value)}>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.job.company || o.job.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={label} htmlFor="n-target">
              The figure you&apos;re asking for
            </label>
            <input id="n-target" className={field} value={target} placeholder="e.g. PKR 450,000 a month" onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <textarea readOnly aria-label="Email text" rows={14} className={`${field} font-[inherit] leading-relaxed`} value={text} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-stone-500">Words in {"{braces}"} still need filling in.</p>
            <button type="button" className={btn.secondary} onClick={() => void navigator.clipboard.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
              <CopyIcon className="size-4" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
