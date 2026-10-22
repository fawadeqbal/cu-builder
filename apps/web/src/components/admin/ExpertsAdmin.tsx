"use client";

import type { MyExpertProfileDto, OrderDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge, DataTable, Icon, Select } from "@cvb/ui";
import { api } from "@/lib/api";
import { SERVICE_LABEL, STATUS_LABEL, money, serviceKeys, when } from "@/lib/services";
import { StatusBadge } from "../services/OrdersPage";

type AdminExpert = MyExpertProfileDto & { email: string };

/** Marketplace operations: approve experts, watch orders, settle disputes and refunds. */
export function ExpertsAdmin() {
  return (
    <div className="flex flex-col gap-8">
      <Experts />
      <Orders />
    </div>
  );
}

function Experts() {
  const qc = useQueryClient();
  const experts = useQuery({
    queryKey: serviceKeys.adminExperts,
    queryFn: () => api.get<AdminExpert[]>("/admin/experts"),
  });
  const set = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/experts/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.adminExperts }),
  });
  return (
    <section className="flex flex-col gap-3">
      <h2 className="cvb-h2">Experts</h2>
      <DataTable<AdminExpert>
        caption="Experts"
        rows={experts.data ?? []}
        rowKey={(e) => e.userId}
        empty={experts.data ? "No applications yet." : undefined}
        columns={[
          {
            key: "expert",
            label: "Expert",
            render: (e) => (
              <div className="flex min-w-44 flex-col">
                <span className="text-ink">{e.displayName}</span>
                <span className="cvb-caption font-normal" dir="ltr">
                  {e.email}
                </span>
              </div>
            ),
          },
          {
            key: "services",
            label: "Services",
            render: (e) => (
              <span className="block min-w-40">{e.services.map((s) => SERVICE_LABEL[s] ?? s).join(", ")}</span>
            ),
          },
          {
            key: "rating",
            label: "Rating",
            numeric: true,
            render: (e) => (e.ratingCount ? `${e.ratingAvg.toFixed(1)} (${e.ratingCount})` : "—"),
          },
          {
            key: "payouts",
            label: "Payouts",
            render: (e) =>
              e.payoutsEnabled ? (
                <Badge tone="success" icon="check-circle">
                  Ready
                </Badge>
              ) : e.payoutsConnected ? (
                <Badge tone="info" icon="clock">
                  Pending
                </Badge>
              ) : (
                <Badge>Not set up</Badge>
              ),
          },
          {
            key: "status",
            label: "Status",
            render: (e) => (
              <Select
                size="sm"
                className="[&_select]:py-1 min-w-32"
                aria-label={`Status of ${e.displayName}`}
                value={e.status}
                onChange={(ev) => set.mutate({ id: e.userId, status: ev.target.value })}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "suspended", label: "Suspended" },
                ]}
              />
            ),
          },
        ]}
      />
    </section>
  );
}

function Orders() {
  const [status, setStatus] = useState("");
  const orders = useQuery({
    queryKey: serviceKeys.adminOrders(status),
    queryFn: () => api.get<OrderDto[]>(`/admin/orders${status ? `?status=${status}` : ""}`),
  });
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="cvb-h2 flex-1">Orders</h2>
        <Select
          size="sm"
          className="[&_select]:py-1"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "", label: "All" },
            ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
      </div>
      <DataTable<OrderDto>
        caption="Orders"
        rows={orders.data ?? []}
        rowKey={(o) => o.id}
        empty={orders.data ? "No orders." : undefined}
        columns={[
          {
            key: "order",
            label: "Order",
            render: (o) => (
              <Link href={`/orders/${o.id}`} className="block min-w-40 text-brand-ink hover:underline">
                {o.name}
              </Link>
            ),
          },
          { key: "customer", label: "Customer", render: (o) => o.buyer.name },
          {
            key: "expert",
            label: "Expert",
            render: (o) =>
              o.expert?.displayName ?? (
                <Badge tone="warning" icon="alert-triangle">
                  Unassigned
                </Badge>
              ),
          },
          {
            key: "due",
            label: "Due",
            render: (o) => {
              const late = o.dueAt && new Date(o.dueAt) < new Date() && ["paid", "in_progress"].includes(o.status);
              return late ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-danger">
                  <Icon name="clock" size={14} /> {when(o.dueAt!)}
                </span>
              ) : (
                <span className="whitespace-nowrap">{o.dueAt ? when(o.dueAt) : "—"}</span>
              );
            },
          },
          {
            key: "price",
            label: "Price",
            numeric: true,
            render: (o) => (o.included ? "Included" : money(o.priceCents, o.currency)),
          },
          { key: "status", label: "Status", render: (o) => <StatusBadge status={o.status} /> },
        ]}
      />
      <p className="cvb-caption">Open an order to refund it, settle a dispute, reassign it or retry a payout.</p>
    </section>
  );
}
