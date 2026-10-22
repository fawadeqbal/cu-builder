"use client";

import type { MyExpertProfileDto, OrderDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { serviceKeys } from "@/lib/services";
import { btn, card, field } from "../ui/styles";

/** Admin tools on one order: refund, settle a dispute, reassign, retry a payout. */
export function AdminOrderActions({ order: o, onDone }: { order: OrderDto; onDone?: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expertId, setExpertId] = useState("");
  const experts = useQuery({ queryKey: serviceKeys.adminExperts, queryFn: () => api.get<MyExpertProfileDto[]>("/admin/experts") });
  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => api.post<OrderDto>(`/admin/orders/${o.id}/${path}`, body ?? {}),
    onSuccess: (next) => {
      qc.setQueryData(serviceKeys.order(o.id), next);
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      setNote("");
      onDone?.();
    },
  });
  const cents = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
  const refundable = ["paid", "in_progress", "delivered", "completed", "disputed"].includes(o.status) && o.priceCents > 0;

  return (
    <section className={`${card} flex flex-col gap-3 p-5`} aria-label="Admin actions">
      <h2 className="text-sm font-semibold text-stone-900">Admin</h2>
      {(refundable || o.status === "disputed") && (
        <>
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <input aria-label="Amount to refund (blank for all)" inputMode="decimal" className={field} placeholder="All" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input aria-label="Reason or note" className={field} placeholder="Reason (sent to the customer)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {o.status === "disputed" ? (
              <>
                <button type="button" className={btn.danger} disabled={act.isPending || note.trim().length < 3} onClick={() => act.mutate({ path: "resolve", body: { outcome: "refund", amountCents: cents, note } })}>
                  Refund
                </button>
                <button type="button" className={btn.secondary} disabled={act.isPending || note.trim().length < 3} onClick={() => act.mutate({ path: "resolve", body: { outcome: "release", note } })}>
                  Release to expert
                </button>
                <button type="button" className={btn.secondary} disabled={act.isPending || note.trim().length < 3} onClick={() => act.mutate({ path: "resolve", body: { outcome: "rework", note } })}>
                  Send back for rework
                </button>
              </>
            ) : (
              <button type="button" className={btn.danger} disabled={act.isPending || note.trim().length < 3} onClick={() => window.confirm("Refund this order?") && act.mutate({ path: "refund", body: { amountCents: cents, reason: note } })}>
                Refund
              </button>
            )}
          </div>
        </>
      )}
      {["paid", "in_progress"].includes(o.status) && (
        <div className="flex flex-wrap gap-2">
          <select aria-label="Assign to" className={`${field} w-auto`} value={expertId} onChange={(e) => setExpertId(e.target.value)}>
            <option value="">Assign to…</option>
            {experts.data
              ?.filter((e) => e.status === "approved")
              .map((e) => (
                <option key={e.userId} value={e.userId}>
                  {e.displayName}
                </option>
              ))}
          </select>
          <button type="button" className={btn.secondary} disabled={!expertId || act.isPending} onClick={() => act.mutate({ path: "assign", body: { expertId } })}>
            Assign
          </button>
        </div>
      )}
      {o.status === "completed" && !o.paidOut && o.expert && (
        <button type="button" className={`${btn.secondary} self-start`} disabled={act.isPending} onClick={() => act.mutate({ path: "payout" })}>
          Retry payout
        </button>
      )}
      {act.error && <p className="text-sm text-red-600">{act.error.message}</p>}
    </section>
  );
}
