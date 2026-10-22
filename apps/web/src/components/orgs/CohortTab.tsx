"use client";

import type { OrgDto } from "@cvb/contracts";
import Link from "next/link";
import { useState } from "react";
import { DownloadIcon } from "@cvb/ui";
import { useCohort } from "@/lib/orgs";
import { btn, card, field } from "../ui/styles";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—");

/** The career office's view: who has a CV, how strong it is, and how the job hunt is going. */
export function CohortTab({ org, canExport }: { org: OrgDto; canExport: boolean }) {
  const [cohort, setCohort] = useState("");
  const [search, setSearch] = useState("");
  const data = useCohort(org.id, cohort);
  const d = data.data;
  const needle = search.trim().toLowerCase();
  const rows = (d?.rows ?? []).filter((r) => !needle || `${r.name} ${r.email}`.toLowerCase().includes(needle));
  const m = d?.metrics;
  const tiles = m
    ? ([
        ["Students", m.students, `${m.active30} active this month`],
        ["Have a CV", `${m.withCvPct}%`, `${m.withCv} students`],
        ["Average ATS score", m.avgAts ?? "—", "best CV per student"],
        ["Applications", m.applications, `${m.interviews} interviews`],
        ["Offers", m.offers, `${m.placedPct}% placed`],
      ] as const)
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-stone-600">
          Cohort
          <select aria-label="Cohort" className={`${field} mt-1 w-48`} value={cohort} onChange={(e) => setCohort(e.target.value)}>
            <option value="">Everyone</option>
            {d?.cohorts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <input type="search" aria-label="Search students" placeholder="Search by name or email" className={`${field} w-64`} value={search} onChange={(e) => setSearch(e.target.value)} />
        {canExport && (
          <a href={`/api/v1/orgs/${org.id}/cohort.csv${cohort ? `?cohort=${encodeURIComponent(cohort)}` : ""}`} className={`${btn.secondary} ms-auto`} download>
            <DownloadIcon className="size-4" /> Export CSV
          </a>
        )}
      </div>

      {data.isLoading ? (
        <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Cohort metrics">
            {tiles.map(([k, v, sub]) => (
              <div key={k} className={`${card} px-4 py-3`}>
                <div className="text-xs font-medium text-stone-500">{k}</div>
                <div className="text-2xl font-semibold tabular-nums text-stone-900">{v}</div>
                <div className="text-xs text-stone-500">{sub}</div>
              </div>
            ))}
          </div>
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-start text-sm">
                <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <tr>
                    {["Student", "Cohort", "CVs", "ATS", "Applied", "Interviews", "Offers", "Last active", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-start">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((r) => (
                    <tr key={r.userId}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-stone-900">{r.name || r.email}</div>
                        <div className="text-xs text-stone-500">{r.email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">{r.cohort || "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums">{r.cvs}</td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {r.bestAts === null ? "—" : <span className={r.bestAts >= 75 ? "text-emerald-700" : r.bestAts >= 50 ? "text-amber-700" : "text-red-700"}>{r.bestAts}</span>}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{r.applications}</td>
                      <td className="px-4 py-2.5 tabular-nums">{r.interviews}</td>
                      <td className="px-4 py-2.5 tabular-nums">{r.placed ? <span className="font-semibold text-emerald-700">{r.offers}</span> : r.offers}</td>
                      <td className="px-4 py-2.5 text-stone-500">{day(r.lastActiveAt)}</td>
                      <td className="px-4 py-2.5 text-end">
                        {r.bestResumeId && (
                          <Link href={`/review/${r.bestResumeId}`} className="text-sm font-medium text-brand hover:underline">
                            Review CV
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-stone-500">
                        No students yet. Invite them from Members &amp; invites, or share your join link.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
