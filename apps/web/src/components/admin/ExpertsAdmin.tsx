"use client";

import type { MyExpertProfileDto, OrderDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { SERVICE_LABEL, STATUS_LABEL, money, serviceKeys, when } from "@/lib/services";
import { StatusBadge } from "../services/OrdersPage";
import { card, field } from "../ui/styles";

type AdminExpert = MyExpertProfileDto & { email: string };

/** Marketplace operations: approve experts, watch orders, settle disputes and refunds. */
export function ExpertsAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <Experts />
      <Orders />
    </div>
  );
}

function Experts() {
  const qc = useQueryClient();
  const experts = useQuery({ queryKey: serviceKeys.adminExperts, queryFn: () => api.get<AdminExpert[]>("/admin/experts") });
  const set = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/experts/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.adminExperts }),
  });
  return (
    <section className={`${card} overflow-hidden`}>
      <h2 className="border-b border-stone-100 px-4 py-3 text-base font-semibold text-stone-900">Experts</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-start text-sm">
          <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2.5">Expert</th>
              <th className="px-4 py-2.5">Services</th>
              <th className="px-4 py-2.5">Rating</th>
              <th className="px-4 py-2.5">Payouts</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {experts.data?.map((e) => (
              <tr key={e.userId}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-stone-900">{e.displayName}</div>
                  <div className="text-xs text-stone-500">{e.email}</div>
                </td>
                <td className="px-4 py-2.5 text-stone-600">{e.services.map((s) => SERVICE_LABEL[s] ?? s).join(", ")}</td>
                <td className="px-4 py-2.5 tabular-nums text-stone-600">{e.ratingCount ? `${e.ratingAvg.toFixed(1)} (${e.ratingCount})` : "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">{e.payoutsEnabled ? "Ready" : e.payoutsConnected ? "Pending" : "Not set up"}</td>
                <td className="px-4 py-2.5">
                  <select
                    aria-label={`Status of ${e.displayName}`}
                    className={`${field} py-1`}
                    value={e.status}
                    onChange={(ev) => set.mutate({ id: e.userId, status: ev.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </td>
              </tr>
            ))}
            {experts.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No applications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Orders() {
  const [status, setStatus] = useState("");
  const orders = useQuery({ queryKey: serviceKeys.adminOrders(status), queryFn: () => api.get<OrderDto[]>(`/admin/orders${status ? `?status=${status}` : ""}`) });
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
        <h2 className="flex-1 text-base font-semibold text-stone-900">Orders</h2>
        <select aria-label="Filter by status" className={`${field} w-auto py-1`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-start text-sm">
          <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Expert</th>
              <th className="px-4 py-2.5">Due</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {orders.data?.map((o) => {
              const late = o.dueAt && new Date(o.dueAt) < new Date() && ["paid", "in_progress"].includes(o.status);
              return (
                <tr key={o.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/orders/${o.id}`} className="font-medium text-brand hover:underline">
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-stone-700">{o.buyer.name}</td>
                  <td className="px-4 py-2.5 text-stone-700">{o.expert?.displayName ?? <span className="text-amber-700">Unassigned</span>}</td>
                  <td className={`px-4 py-2.5 ${late ? "font-semibold text-red-600" : "text-stone-600"}`}>{o.dueAt ? when(o.dueAt) : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-stone-600">{o.included ? "Included" : money(o.priceCents, o.currency)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              );
            })}
            {orders.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                  No orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-stone-500">Open an order to refund it, settle a dispute, reassign it or retry a payout.</p>
    </section>
  );
}
