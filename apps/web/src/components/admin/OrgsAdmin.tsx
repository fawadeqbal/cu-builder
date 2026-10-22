"use client";

import type { AdminOrgDto, AdminUpdateOrgDto } from "@cvb/contracts";
import { PLANS, type Plan } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { ORG_KIND_LABEL } from "@/lib/orgs";
import { PLAN_LABEL } from "@/lib/plans";
import { card, field } from "../ui/styles";

const KEY = ["admin", "orgs"] as const;

/** Site admin: every organisation, with its seat licences and seat plan. */
export function OrgsAdmin() {
  const orgs = useQuery({ queryKey: KEY, queryFn: () => api.get<AdminOrgDto[]>("/admin/orgs") });
  if (!orgs.data) return <p className="text-sm text-stone-500">Loading…</p>;
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              {["Organisation", "Type", "Seats (used / licensed)", "Seat plan", "Members"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-start">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {orgs.data.map((o) => (
              <OrgRow key={o.id} org={o} />
            ))}
            {orgs.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No organisations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrgRow({ org }: { org: AdminOrgDto }) {
  const qc = useQueryClient();
  const [seats, setSeats] = useState(String(org.seats));
  const save = useMutation({
    mutationFn: (patch: AdminUpdateOrgDto) => api.patch<AdminOrgDto>(`/admin/orgs/${org.id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  return (
    <tr>
      <td className="px-4 py-2.5">
        <Link href={`/org/${org.id}`} className="font-medium text-stone-900 hover:underline">
          {org.name}
        </Link>
        <div className="text-xs text-stone-500">since {new Date(org.createdAt).toLocaleDateString()}</div>
        {save.error && <div className="text-xs text-red-600">{save.error.message}</div>}
      </td>
      <td className="px-4 py-2.5">
        <select aria-label={`Type of ${org.name}`} className={`${field} py-1`} value={org.kind} onChange={(e) => save.mutate({ kind: e.target.value as AdminOrgDto["kind"] })}>
          {(Object.keys(ORG_KIND_LABEL) as AdminOrgDto["kind"][]).map((k) => (
            <option key={k} value={k}>
              {ORG_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <span className="me-2 tabular-nums text-stone-600">{org.seatsUsed} /</span>
        <input
          aria-label={`Seats for ${org.name}`}
          inputMode="numeric"
          className={`${field} w-24 py-1`}
          value={seats}
          onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))}
          onBlur={() => Number(seats) !== org.seats && save.mutate({ seats: Number(seats || 0) })}
        />
      </td>
      <td className="px-4 py-2.5">
        <select aria-label={`Seat plan of ${org.name}`} className={`${field} py-1`} value={org.seatPlan} onChange={(e) => save.mutate({ seatPlan: e.target.value as Plan })}>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {PLAN_LABEL[p]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5 tabular-nums">{org.members}</td>
    </tr>
  );
}
