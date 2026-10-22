"use client";

import type { ExpertDto } from "@cvb/contracts";
import Link from "next/link";
import { useState } from "react";
import { SERVICE_LABEL, money, turnaround, useCatalog, useExperts } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { card, field } from "../ui/styles";

export function Stars({ avg, count }: { avg: number; count: number }) {
  if (!count) return <span className="text-xs text-stone-500">New</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-stone-600" aria-label={`Rated ${avg.toFixed(1)} out of 5 by ${count} customers`}>
      <span className="text-amber-500" aria-hidden>
        ★
      </span>
      <span className="font-semibold text-stone-800">{avg.toFixed(1)}</span> ({count})
    </span>
  );
}

export function Avatar({ name, photoUrl, size = "size-12" }: { name: string; photoUrl: string | null; size?: string }) {
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- external profile photos of any host
    <img src={photoUrl} alt="" className={`${size} shrink-0 rounded-full object-cover ring-1 ring-stone-200`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-brand/10 text-base font-semibold uppercase text-brand`} aria-hidden>
      {name.slice(0, 1)}
    </span>
  );
}

/** The marketplace front: services with prices, and the directory of approved experts. */
export function ExpertsPage() {
  const catalog = useCatalog();
  const [service, setService] = useState("");
  const [language, setLanguage] = useState("");
  const experts = useExperts(service, language.trim());

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Work with an expert</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">Vetted recruiters and career coaches review your CV line by line, write it for you, or coach you one to one.</p>
          </div>
          <Link href="/expert" className="text-sm font-medium text-brand hover:underline">
            Are you a career expert? Join us →
          </Link>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Services">
          {catalog.data
            ?.filter((s) => s.kind !== "review_rush")
            .map((s) => (
              <li key={s.kind} className={`${card} flex flex-col gap-1 p-4`}>
                <h2 className="text-sm font-semibold text-stone-900">{s.name}</h2>
                <p className="flex-1 text-xs leading-relaxed text-stone-600">{s.description}</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {s.kind === "coaching" ? `from ${money(5900)}` : money(s.priceCents)}
                  <span className="ms-1 text-xs font-normal text-stone-500">· {turnaround(s.turnaroundHours)}</span>
                </p>
              </li>
            ))}
        </ul>

        <div className={`${card} mt-8 flex flex-wrap items-end gap-3 p-3`}>
          <label className="min-w-40 flex-1 text-xs font-medium text-stone-600">
            Service
            <select className={`${field} mt-1`} value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">Any</option>
              {Object.entries(SERVICE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-40 flex-1 text-xs font-medium text-stone-600">
            Language
            <input className={`${field} mt-1`} value={language} placeholder="e.g. Urdu" onChange={(e) => setLanguage(e.target.value)} />
          </label>
        </div>

        {experts.isLoading ? (
          <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
        ) : !experts.data?.length ? (
          <p className="mt-4 rounded-xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">
            No experts match yet. You can still order a review: we&apos;ll match you with the first available expert.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Experts">
            {experts.data.map((e) => (
              <ExpertCard key={e.userId} expert={e} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ExpertCard({ expert: e }: { expert: ExpertDto }) {
  return (
    <li>
      <Link href={`/experts/${e.userId}`} className={`${card} flex h-full gap-4 p-4 transition hover:border-stone-300`}>
        <Avatar name={e.displayName} photoUrl={e.photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold text-stone-900">{e.displayName}</h2>
            <Stars avg={e.ratingAvg} count={e.ratingCount} />
          </div>
          {e.headline && <p className="truncate text-sm text-stone-600">{e.headline}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {e.services.map((s) => (
              <span key={s} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                {SERVICE_LABEL[s] ?? s}
              </span>
            ))}
            {e.languages.map((l) => (
              <span key={l} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                {l}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </li>
  );
}
