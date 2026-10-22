"use client";

import type { OrderDto } from "@cvb/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Skeleton, type IconName, type Tone } from "@cvb/ui";
import { STATUS_LABEL, money, useOrders, when } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { BookDialog } from "./BookDialog";

const STATUS_BADGE: Record<OrderDto["status"], [Tone, IconName]> = {
  pending_payment: ["warning", "credit"],
  paid: ["neutral", "clock"],
  in_progress: ["info", "edit"],
  delivered: ["brand", "check"],
  completed: ["success", "check-circle"],
  cancelled: ["neutral", "x"],
  refunded: ["neutral", "undo"],
  disputed: ["danger", "alert-triangle"],
};

/** An order's status as a word with an icon, never colour alone. */
export function StatusBadge({ status }: { status: OrderDto["status"] }) {
  const [tone, icon] = STATUS_BADGE[status];
  return (
    <Badge tone={tone} icon={icon} className="whitespace-nowrap">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** The buyer's expert orders. */
export function OrdersPage() {
  return <RequireAuth>{() => <Orders />}</RequireAuth>;
}

function Orders() {
  const orders = useOrders();
  const router = useRouter();
  const [ordering, setOrdering] = useState(false);
  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6 [&_.cvb-table-wrap]:relative">
        <PageHeader
          title="Expert orders"
          actions={
            <>
              <Button href="/experts">Browse experts</Button>
              <Button variant="primary" icon="plus" onClick={() => setOrdering(true)}>
                Order a review
              </Button>
            </>
          }
        />
        {orders.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={52} shape="block" />
            ))}
          </div>
        ) : !orders.data?.length ? (
          <Card>
            <EmptyState icon="users" title="No orders yet">
              <p>A recruiter&apos;s line-by-line review is the fastest way to a stronger CV.</p>
            </EmptyState>
          </Card>
        ) : (
          <DataTable<OrderDto>
            caption="Orders"
            rows={orders.data}
            rowKey={(o) => o.id}
            onRowClick={(o) => router.push(`/orders/${o.id}`)}
            columns={[
              {
                key: "name",
                label: "Service",
                render: (o) => (
                  <Link
                    href={`/orders/${o.id}`}
                    className="whitespace-nowrap hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {o.name}
                  </Link>
                ),
              },
              {
                key: "expert",
                label: "Expert",
                render: (o) =>
                  o.expert ? o.expert.displayName : <span className="text-ink-3">Matching an expert</span>,
              },
              { key: "cv", label: "CV", render: (o) => o.resumeTitle || <span className="text-ink-3">Not set</span> },
              {
                key: "date",
                label: "Ordered",
                render: (o) => (
                  <span className="flex flex-col whitespace-nowrap">
                    <span className="tabular-nums">{new Date(o.createdAt).toLocaleDateString()}</span>
                    {o.scheduledAt && <span className="cvb-caption">Session {when(o.scheduledAt)}</span>}
                  </span>
                ),
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
        )}
      </main>
      {ordering && <BookDialog open onClose={() => setOrdering(false)} initialKind="review" />}
    </div>
  );
}
