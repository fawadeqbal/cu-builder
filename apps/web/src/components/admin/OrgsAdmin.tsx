"use client";

import type { AdminOrgDto, AdminUpdateOrgDto } from "@cvb/contracts";
import { PLANS, type Plan } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { DataTable, Select, Skeleton, TextField } from "@cvb/ui";
import { api } from "@/lib/api";
import { ORG_KIND_LABEL } from "@/lib/orgs";
import { PLAN_LABEL } from "@/lib/plans";

const KEY = ["admin", "orgs"] as const;

type Save = (id: string, patch: AdminUpdateOrgDto) => void;

/** Site admin: every organisation, with its seat licences and seat plan. */
export function OrgsAdmin() {
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: KEY, queryFn: () => api.get<AdminOrgDto[]>("/admin/orgs") });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AdminUpdateOrgDto }) =>
      api.patch<AdminOrgDto>(`/admin/orgs/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const save: Save = (id, patch) => update.mutate({ id, patch });
  if (!orgs.data) return <Skeleton height={240} shape="block" />;
  return (
    <DataTable<AdminOrgDto>
      caption="Organisations"
      rows={orgs.data}
      rowKey={(o) => o.id}
      empty="No organisations yet."
      columns={[
        {
          key: "name",
          label: "Organisation",
          render: (o) => (
            <div className="flex min-w-44 flex-col">
              <Link href={`/org/${o.id}`} className="text-ink hover:text-brand-ink hover:underline">
                {o.name}
              </Link>
              <span className="cvb-caption font-normal">since {new Date(o.createdAt).toLocaleDateString()}</span>
              {update.error && update.variables?.id === o.id && (
                <span className="text-xs font-normal text-danger" role="alert">
                  {update.error.message}
                </span>
              )}
            </div>
          ),
        },
        {
          key: "kind",
          label: "Type",
          render: (o) => (
            <Select
              size="sm"
              className="[&_select]:py-1 min-w-36"
              aria-label={`Type of ${o.name}`}
              value={o.kind}
              onChange={(e) => save(o.id, { kind: e.target.value as AdminOrgDto["kind"] })}
              options={(Object.keys(ORG_KIND_LABEL) as AdminOrgDto["kind"][]).map((k) => ({
                value: k,
                label: ORG_KIND_LABEL[k],
              }))}
            />
          ),
        },
        { key: "seats", label: "Seats (used / licensed)", render: (o) => <OrgSeats org={o} save={save} /> },
        {
          key: "seatPlan",
          label: "Seat plan",
          render: (o) => (
            <Select
              size="sm"
              className="[&_select]:py-1 min-w-32"
              aria-label={`Seat plan of ${o.name}`}
              value={o.seatPlan}
              onChange={(e) => save(o.id, { seatPlan: e.target.value as Plan })}
              options={PLANS.map((p) => ({ value: p, label: PLAN_LABEL[p] }))}
            />
          ),
        },
        { key: "members", label: "Members", numeric: true, render: (o) => o.members },
      ]}
    />
  );
}

function OrgSeats({ org, save }: { org: AdminOrgDto; save: Save }) {
  const [seats, setSeats] = useState(String(org.seats));
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-ink-2">{org.seatsUsed} /</span>
      <TextField
        size="sm"
        inputClassName="py-1"
        className="w-24"
        aria-label={`Seats for ${org.name}`}
        inputMode="numeric"
        value={seats}
        onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))}
        onBlur={() => Number(seats) !== org.seats && save(org.id, { seats: Number(seats || 0) })}
      />
    </div>
  );
}
