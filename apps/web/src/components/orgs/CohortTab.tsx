"use client";

import type { CohortDto, OrgDto } from "@cvb/contracts";
import Link from "next/link";
import { useState } from "react";
import { Button, DataTable, Icon, ScoreRing, SearchField, Select, Skeleton, StatTile } from "@cvb/ui";
import { useCohort } from "@/lib/orgs";

type Row = CohortDto["rows"][number];

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

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
    <div className="flex flex-col gap-6 [&_.cvb-table-wrap]:relative">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          aria-label="Cohort"
          label="Cohort"
          className="w-full sm:w-48"
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
        >
          <option value="">Everyone</option>
          {d?.cohorts.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <SearchField
          label="Search students"
          placeholder="Search by name or email"
          className="w-full sm:w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canExport && (
          <Button
            icon="download"
            className="sm:ms-auto"
            href={`/api/v1/orgs/${org.id}/cohort.csv${cohort ? `?cohort=${encodeURIComponent(cohort)}` : ""}`}
            download
          >
            Export CSV
          </Button>
        )}
      </div>

      {data.isLoading ? (
        <div className="cvb-stat-grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={104} shape="block" />
          ))}
        </div>
      ) : (
        tiles.length > 0 && (
          <div className="cvb-stat-grid" aria-label="Cohort metrics" role="group">
            {tiles.map(([k, v, sub]) => (
              <StatTile key={k} label={k} value={v} hint={sub} />
            ))}
          </div>
        )
      )}

      {data.isLoading ? (
        <Skeleton height={200} shape="block" />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="cvb-caption" role="status">
            {rows.length} {rows.length === 1 ? "student" : "students"}
          </p>
          <DataTable<Row>
            caption="Students"
            rows={rows}
            rowKey={(r) => r.userId}
            empty="No students yet. Invite them from Members & invites, or share your join link."
            columns={[
              {
                key: "student",
                label: "Student",
                render: (r) => (
                  <span className="flex flex-col">
                    <span className="text-ink">{r.name || r.email}</span>
                    <span className="cvb-caption font-normal">{r.email}</span>
                  </span>
                ),
              },
              {
                key: "cohort",
                label: "Cohort",
                render: (r) => r.cohort || <span className="text-ink-3">Not set</span>,
              },
              { key: "cvs", label: "CVs", numeric: true, render: (r) => r.cvs },
              {
                key: "ats",
                label: "ATS",
                render: (r) =>
                  r.bestAts === null ? (
                    <span className="text-ink-3">—</span>
                  ) : (
                    <ScoreRing
                      size="sm"
                      value={r.bestAts}
                      tone={r.bestAts >= 75 ? "success" : r.bestAts >= 50 ? "warning" : "danger"}
                      label={`ATS score ${r.bestAts} out of 100`}
                    />
                  ),
              },
              { key: "applied", label: "Applied", numeric: true, render: (r) => r.applications },
              { key: "interviews", label: "Interviews", numeric: true, render: (r) => r.interviews },
              {
                key: "offers",
                label: "Offers",
                numeric: true,
                render: (r) =>
                  r.placed ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-success" title="Placed">
                      <Icon name="check-circle" size={14} label="Placed" />
                      {r.offers}
                    </span>
                  ) : (
                    r.offers
                  ),
              },
              {
                key: "last",
                label: "Last active",
                render: (r) => <span className="whitespace-nowrap">{day(r.lastActiveAt)}</span>,
              },
              {
                key: "review",
                label: <span className="cvb-sr">Actions</span>,
                render: (r) =>
                  r.bestResumeId && (
                    <Link
                      href={`/review/${r.bestResumeId}`}
                      className="whitespace-nowrap font-medium text-brand-ink hover:underline"
                    >
                      Review CV
                    </Link>
                  ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
