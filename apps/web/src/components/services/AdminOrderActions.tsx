"use client";

import type { MyExpertProfileDto, OrderDto } from "@cvb/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { serviceKeys } from "@/lib/services";
import { Alert, Button, Card, Select, TextField } from "@cvb/ui";

/** Admin tools on one order: refund, settle a dispute, reassign, retry a payout. */
export function AdminOrderActions({ order: o, onDone }: { order: OrderDto; onDone?: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expertId, setExpertId] = useState("");
  const experts = useQuery({
    queryKey: serviceKeys.adminExperts,
    queryFn: () => api.get<MyExpertProfileDto[]>("/admin/experts"),
  });
  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      api.post<OrderDto>(`/admin/orders/${o.id}/${path}`, body ?? {}),
    onSuccess: (next) => {
      qc.setQueryData(serviceKeys.order(o.id), next);
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      setNote("");
      onDone?.();
    },
  });
  const cents = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
  const refundable =
    ["paid", "in_progress", "delivered", "completed", "disputed"].includes(o.status) && o.priceCents > 0;

  return (
    <section aria-label="Admin actions">
      <Card as="div" title="Admin">
        {(refundable || o.status === "disputed") && (
          <>
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
              <TextField
                aria-label="Amount to refund (blank for all)"
                inputMode="decimal"
                placeholder="All"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <TextField
                aria-label="Reason or note"
                placeholder="Reason (sent to the customer)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {o.status === "disputed" ? (
                <>
                  <Button
                    variant="danger"
                    disabled={act.isPending || note.trim().length < 3}
                    onClick={() =>
                      act.mutate({ path: "resolve", body: { outcome: "refund", amountCents: cents, note } })
                    }
                  >
                    Refund
                  </Button>
                  <Button
                    disabled={act.isPending || note.trim().length < 3}
                    onClick={() => act.mutate({ path: "resolve", body: { outcome: "release", note } })}
                  >
                    Release to expert
                  </Button>
                  <Button
                    disabled={act.isPending || note.trim().length < 3}
                    onClick={() => act.mutate({ path: "resolve", body: { outcome: "rework", note } })}
                  >
                    Send back for rework
                  </Button>
                </>
              ) : (
                <Button
                  variant="danger"
                  disabled={act.isPending || note.trim().length < 3}
                  onClick={() =>
                    window.confirm("Refund this order?") &&
                    act.mutate({ path: "refund", body: { amountCents: cents, reason: note } })
                  }
                >
                  Refund
                </Button>
              )}
            </div>
          </>
        )}
        {["paid", "in_progress"].includes(o.status) && (
          <div className="flex flex-wrap gap-2">
            <Select aria-label="Assign to" value={expertId} onChange={(e) => setExpertId(e.target.value)}>
              <option value="">Assign to…</option>
              {experts.data
                ?.filter((e) => e.status === "approved")
                .map((e) => (
                  <option key={e.userId} value={e.userId}>
                    {e.displayName}
                  </option>
                ))}
            </Select>
            <Button
              disabled={!expertId || act.isPending}
              onClick={() => act.mutate({ path: "assign", body: { expertId } })}
            >
              Assign
            </Button>
          </div>
        )}
        {o.status === "completed" && !o.paidOut && o.expert && (
          <Button className="self-start" disabled={act.isPending} onClick={() => act.mutate({ path: "payout" })}>
            Retry payout
          </Button>
        )}
        {act.error && <Alert tone="danger">{act.error.message}</Alert>}
      </Card>
    </section>
  );
}
