"use client";

import type { ApplicationDto, MeDto } from "@cvb/contracts";
import { NEGOTIATION_TEMPLATES, compareOffers, fillTemplate, totalComp } from "@cvb/domain";
import { useState, type ReactNode } from "react";
import { Button, Card, EmptyState, Icon, Select, Stars, TextArea, TextField } from "@cvb/ui";

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
      <Card title="Compare offers" flush>
        {offers.length === 0 ? (
          <EmptyState icon="award" title="No offers to compare yet">
            Open an application and add its offer details (Offer tab) to compare them here.
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="cvb-table min-w-[40rem]">
                <caption className="sr-only">Offers side by side</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Detail</span>
                    </th>
                    {offers.map((o) => (
                      <th key={o.id} scope="col" className="normal-case tracking-normal">
                        <button type="button" className="text-start text-sm font-semibold text-ink hover:underline" onClick={() => onOpen(o.id)}>
                          {o.job.company || o.job.title}
                        </button>
                        <div className="text-xs font-normal text-ink-3">{o.job.title}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Base salary", (o) => <span className="cvb-num">{fmt(o.offer.baseSalary, o.offer.currency)}</span>],
                      ["Bonus", (o) => <span className="cvb-num">{fmt(o.offer.bonus, o.offer.currency)}</span>],
                      ["Equity / year", (o) => <span className="cvb-num">{fmt(o.offer.equity, o.offer.currency)}</span>],
                      [
                        "Total",
                        (o) => (
                          <strong className={`cvb-num inline-flex flex-wrap items-center gap-1 ${best.bestTotal === o.id ? "text-success" : "text-ink"}`}>
                            {best.bestTotal === o.id && <Icon name="check-circle" size={16} />}
                            {fmt(totalComp(o.offer), o.offer.currency)}
                            {best.bestTotal === o.id ? " · highest" : ""}
                          </strong>
                        ),
                      ],
                      ["Work", (o) => REMOTE[o.offer.remote] ?? "—"],
                      ["Location", (o) => o.offer.location || "—"],
                      [
                        "Growth",
                        (o) =>
                          o.offer.growth ? (
                            <span className={`inline-flex flex-wrap items-center gap-1.5 ${best.bestGrowth === o.id ? "font-semibold text-success" : ""}`}>
                              <Stars value={o.offer.growth} size={14} label={`Growth ${o.offer.growth} out of 5`} />
                              {best.bestGrowth === o.id && <span className="text-xs">highest</span>}
                            </span>
                          ) : (
                            "—"
                          ),
                      ],
                      ["Benefits", (o) => <span className="whitespace-pre-line">{o.offer.benefits || "—"}</span>],
                      ["Answer by", (o) => (o.offer.deadline ? new Date(o.offer.deadline).toLocaleDateString() : "—")],
                    ] as [string, (o: (typeof offers)[number]) => ReactNode][]
                  ).map(([name, cell]) => (
                    <tr key={name}>
                      <th scope="row" className="w-40 bg-surface-2">
                        {name}
                      </th>
                      {offers.map((o) => (
                        <td key={o.id} className="align-top">
                          {cell(o)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cvb-caption border-t border-line px-5 py-3">Totals add base, bonus and yearly equity value in each offer&apos;s own currency.</p>
          </>
        )}
      </Card>

      <Card title="Negotiation templates">
        <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
          <div className="flex flex-col gap-4">
            <Select
              id="n-template"
              label="Situation"
              hint={template.when}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              options={NEGOTIATION_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
            />
            {offers.length > 0 && (
              <Select id="n-offer" label="Offer" value={app?.id ?? ""} onChange={(e) => setAppId(e.target.value)} options={offers.map((o) => ({ value: o.id, label: o.job.company || o.job.title }))} />
            )}
            <TextField id="n-target" label="The figure you're asking for" value={target} placeholder="e.g. PKR 450,000 a month" onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <TextArea readOnly aria-label="Email text" rows={14} value={text} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="cvb-caption">Words in {"{braces}"} still need filling in.</p>
              <Button icon={copied ? "check" : "copy"} onClick={() => void navigator.clipboard.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
