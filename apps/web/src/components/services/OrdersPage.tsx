"use client";

import type { OrderDto } from "@cvb/contracts";
import Link from "next/link";
import { useState } from "react";
import { PlusIcon } from "@cvb/ui";
import { STATUS_LABEL, STATUS_TONE, money, useOrders, when } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { btn, card } from "../ui/styles";
import { BookDialog } from "./BookDialog";

export function StatusBadge({ status }: { status: OrderDto["status"] }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** The buyer's expert orders. */
export function OrdersPage() {
  return <RequireAuth>{() => <Orders />}</RequireAuth>;
}

function Orders() {
  const orders = useOrders();
  const [ordering, setOrdering] = useState(false);
  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-2xl font-semibold tracking-tight text-stone-900">Expert orders</h1>
          <Link href="/experts" className={btn.secondary}>
            Browse experts
          </Link>
          <button type="button" className={btn.primary} onClick={() => setOrdering(true)}>
            <PlusIcon className="size-4" /> Order a review
          </button>
        </div>
        {orders.isLoading ? (
          <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
        ) : !orders.data?.length ? (
          <p className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">
            No orders yet. A recruiter&apos;s line-by-line review is the fastest way to a stronger CV.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2" aria-label="Orders">
            {orders.data.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className={`${card} flex items-center gap-4 p-4 hover:border-stone-300`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-stone-900">{o.name}</div>
                    <div className="text-xs text-stone-500">
                      {o.expert ? `with ${o.expert.displayName}` : "Matching an expert"}
                      {o.resumeTitle && ` · ${o.resumeTitle}`} · ordered {new Date(o.createdAt).toLocaleDateString()}
                      {o.scheduledAt && ` · session ${when(o.scheduledAt)}`}
                    </div>
                  </div>
                  <span className="text-sm text-stone-600">{o.included ? "Included" : money(o.priceCents, o.currency)}</span>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      {ordering && <BookDialog open onClose={() => setOrdering(false)} initialKind="review" />}
    </div>
  );
}
