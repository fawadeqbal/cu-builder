"use client";

import type { OrderDto, OrderMessageDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import { SERVICE_LABEL, money, serviceKeys, useCatalog, useOrder, useOrderMessages, when } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { Dialog } from "../ui/Dialog";
import { FullPageMessage } from "../ui/FullPageMessage";
import { btn, card, field, label } from "../ui/styles";
import { AdminOrderActions } from "./AdminOrderActions";
import { StatusBadge } from "./OrdersPage";

/** One order, for whoever is involved: the buyer, the expert, or an admin. */
export function OrderPage({ id }: { id: string }) {
  return <RequireAuth>{() => <OrderView id={id} />}</RequireAuth>;
}

function useOrderAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body, method = "post" }: { path: string; body?: unknown; method?: "post" | "put" }) =>
      method === "put" ? api.put<OrderDto>(`/orders/${id}/${path}`, body) : api.post<OrderDto>(`/orders/${id}/${path}`, body ?? {}),
    onSuccess: (o) => {
      qc.setQueryData(serviceKeys.order(id), o);
      void qc.invalidateQueries({ queryKey: serviceKeys.messages(id) });
      void qc.invalidateQueries({ queryKey: serviceKeys.orders });
    },
  });
}

function OrderView({ id }: { id: string }) {
  const order = useOrder(id);
  const params = useSearchParams();
  if (order.isLoading) return <FullPageMessage>Loading…</FullPageMessage>;
  const o = order.data;
  if (!o) return <FullPageMessage>Order not found.</FullPageMessage>;
  const back = o.viewerRole === "expert" ? "/expert" : o.viewerRole === "admin" ? "/admin" : "/orders";

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Link href={back} className="text-sm font-medium text-brand hover:underline">
            ← Back
          </Link>
          {params.get("paid") && o.status !== "pending_payment" && <Banner tone="good">Payment received. Thank you!</Banner>}
          {params.get("cancelled") && o.status === "pending_payment" && <Banner tone="warn">Payment was cancelled. You can try again from the expert&apos;s page.</Banner>}
          <section className={`${card} p-5`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold text-stone-900">{o.name}</h1>
                <p className="text-sm text-stone-600">
                  {o.viewerRole === "expert" ? `For ${o.buyer.name}` : o.expert ? `With ${o.expert.displayName}` : "We're matching you with an expert"}
                  {o.resumeTitle && ` · ${o.resumeTitle}`}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <Fact name="Price">{o.included ? "Included in plan" : money(o.priceCents, o.currency)}</Fact>
              {o.expertCents !== null && <Fact name="Expert's share">{money(o.expertCents, o.currency)}{o.paidOut ? " · paid out" : ""}</Fact>}
              {o.dueAt && o.kind !== "coaching" && <Fact name="Due">{when(o.dueAt)}</Fact>}
              {o.scheduledAt && <Fact name="Session">{when(o.scheduledAt)} · {o.durationMin} min</Fact>}
              {o.revisionsIncluded > 0 && <Fact name="Revisions">{o.revisionsUsed} of {o.revisionsIncluded} used</Fact>}
              {o.rating && <Fact name="Rating">{"★".repeat(o.rating)}{"☆".repeat(5 - o.rating)}</Fact>}
            </dl>
            <Timeline o={o} />
          </section>

          {o.meetingUrl && (
            <section className={`${card} flex flex-wrap items-center gap-2 p-5`}>
              <h2 className="w-full text-sm font-semibold text-stone-900">Video call</h2>
              <a href={o.meetingUrl} target="_blank" rel="noreferrer noopener" className={btn.primary}>
                Join the call
              </a>
              {o.calendarUrl && (
                <a href={o.calendarUrl} target="_blank" rel="noreferrer noopener" className={btn.secondary}>
                  Add to Google Calendar
                </a>
              )}
              <a href={`/api/v1/orders/${o.id}/calendar`} className={btn.ghost}>
                Download .ics
              </a>
            </section>
          )}

          {o.resumeId && (
            <section className={`${card} flex flex-wrap items-center gap-3 p-5`}>
              <p className="min-w-0 flex-1 text-sm text-stone-700">
                {o.viewerRole === "buyer" ? "The expert's comments appear next to your CV lines in the editor." : "Comment on the CV line by line; the customer sees your notes in their editor."}
              </p>
              {o.viewerRole === "buyer" ? (
                <Link href={`/edit/${o.resumeId}`} className={btn.secondary}>
                  Open my CV
                </Link>
              ) : (
                <Link href={`/review/${o.resumeId}`} className={btn.primary}>
                  Review the CV
                </Link>
              )}
            </section>
          )}

          <Intake o={o} />
          <Delivery o={o} />
          {o.viewerRole === "expert" && <ExpertActions o={o} />}
          {o.viewerRole === "buyer" && <BuyerActions o={o} />}
          {o.viewerRole === "admin" && <AdminOrderActions order={o} />}
          {o.dispute && (
            <section className={`${card} p-5 text-sm`}>
              <h2 className="font-semibold text-stone-900">Dispute</h2>
              <p className="mt-1 text-stone-700">{o.dispute.reason}</p>
              {o.dispute.resolution && <p className="mt-2 text-stone-600">Resolution: {o.dispute.resolution}</p>}
            </section>
          )}
        </div>
        <Messages o={o} />
      </main>
    </div>
  );
}

function Banner({ tone, children }: { tone: "good" | "warn"; children: ReactNode }) {
  return <p className={`rounded-xl px-4 py-3 text-sm ring-1 ${tone === "good" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>{children}</p>;
}

function Fact({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{name}</dt>
      <dd className="text-stone-800">{children}</dd>
    </div>
  );
}

function Timeline({ o }: { o: OrderDto }) {
  const steps = [
    { name: "Ordered", at: o.createdAt },
    { name: "Paid", at: o.paidAt },
    { name: o.kind === "coaching" ? "Notes shared" : "Delivered", at: o.deliveredAt },
    { name: "Completed", at: o.completedAt },
  ];
  return (
    <ol className="mt-5 flex flex-wrap gap-x-6 gap-y-2" aria-label="Progress">
      {steps.map((s) => (
        <li key={s.name} className={`flex items-center gap-2 text-xs ${s.at ? "text-stone-800" : "text-stone-400"}`}>
          <span className={`size-2 rounded-full ${s.at ? "bg-emerald-500" : "bg-stone-300"}`} aria-hidden />
          {s.name}
          {s.at && <span className="text-stone-500">{new Date(s.at).toLocaleDateString()}</span>}
        </li>
      ))}
    </ol>
  );
}

function Intake({ o }: { o: OrderDto }) {
  const catalog = useCatalog();
  const questions = catalog.data?.find((s) => s.kind === o.kind)?.intake ?? [];
  const answered = questions.filter((q) => o.intake[q.key]);
  if (!answered.length) return null;
  return (
    <section className={`${card} p-5`}>
      <h2 className="text-sm font-semibold text-stone-900">{o.viewerRole === "expert" ? "What the customer told us" : "Your answers"}</h2>
      <dl className="mt-3 flex flex-col gap-3 text-sm">
        {answered.map((q) => (
          <div key={q.key}>
            <dt className="text-xs font-medium text-stone-500">{q.label}</dt>
            <dd className="whitespace-pre-line text-stone-800">{o.intake[q.key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Delivery({ o }: { o: OrderDto }) {
  if (!o.deliveryNote || o.viewerRole === "expert") return null;
  return (
    <section className={`${card} p-5`}>
      <h2 className="text-sm font-semibold text-stone-900">{o.kind === "coaching" ? "Session notes" : "From your expert"}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-800">{o.deliveryNote}</p>
    </section>
  );
}

function ExpertActions({ o }: { o: OrderDto }) {
  const act = useOrderAction(o.id);
  const [note, setNote] = useState(o.deliveryNote);
  const open = o.status === "paid" || o.status === "in_progress";
  const coaching = o.kind === "coaching";
  return (
    <section className={`${card} flex flex-col gap-3 p-5`}>
      <h2 className="text-sm font-semibold text-stone-900">{coaching ? "Session notes" : "Your delivery"}</h2>
      {o.status === "paid" && !coaching && (
        <button type="button" className={`${btn.secondary} self-start`} disabled={act.isPending} onClick={() => act.mutate({ path: "start" })}>
          Start working
        </button>
      )}
      <textarea
        aria-label={coaching ? "Session notes" : "Delivery note"}
        rows={6}
        className={field}
        value={note}
        maxLength={10_000}
        placeholder={coaching ? "What you covered, and the next steps you agreed" : "A summary of your changes and advice. Line comments go on the CV itself."}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {open && (
          <button type="button" className={btn.primary} disabled={act.isPending || !note.trim()} onClick={() => act.mutate({ path: "deliver", body: { note } })}>
            {coaching ? "Share notes and finish" : "Deliver to the customer"}
          </button>
        )}
        <button type="button" className={btn.secondary} disabled={act.isPending || note === o.deliveryNote} onClick={() => act.mutate({ path: "notes", body: { notes: note }, method: "put" })}>
          Save without delivering
        </button>
      </div>
      {act.error && <p className="text-sm text-red-600">{act.error.message}</p>}
    </section>
  );
}

function BuyerActions({ o }: { o: OrderDto }) {
  const act = useOrderAction(o.id);
  const [dialog, setDialog] = useState<"complete" | "revision" | "dispute" | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const canDispute = ["paid", "in_progress", "delivered", "completed"].includes(o.status);
  const run = (path: string, body: unknown) =>
    act.mutate(
      { path, body },
      {
        onSuccess: () => {
          setDialog(null);
          setText("");
        },
      },
    );
  function submit(e: FormEvent) {
    e.preventDefault();
    if (dialog === "complete") run("complete", { rating, comment: text });
    if (dialog === "revision") run("revision", { request: text });
    if (dialog === "dispute") run("dispute", { reason: text });
  }
  if (o.status === "pending_payment") {
    return (
      <section className={`${card} flex items-center gap-3 p-5`}>
        <p className="flex-1 text-sm text-stone-600">This order hasn&apos;t been paid.</p>
        <button type="button" className={btn.secondary} onClick={() => act.mutate({ path: "cancel" })}>
          Cancel order
        </button>
      </section>
    );
  }
  if (o.status !== "delivered" && !canDispute) return null;
  return (
    <section className={`${card} flex flex-wrap items-center gap-2 p-5`}>
      {o.status === "delivered" && (
        <>
          <p className="w-full text-sm text-stone-700">Happy with it? Accept and rate, or ask for changes.</p>
          <button type="button" className={btn.primary} onClick={() => setDialog("complete")}>
            Accept and rate
          </button>
          {o.revisionsUsed < o.revisionsIncluded && (
            <button type="button" className={btn.secondary} onClick={() => setDialog("revision")}>
              Ask for changes ({o.revisionsIncluded - o.revisionsUsed} left)
            </button>
          )}
        </>
      )}
      {canDispute && (
        <button type="button" className="ms-auto text-sm font-medium text-red-600 hover:underline" onClick={() => setDialog("dispute")}>
          Report a problem
        </button>
      )}
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "complete" ? "Rate your expert" : dialog === "revision" ? "What should change?" : "Report a problem"}
        description={dialog === "dispute" ? "Our team reviews every report within two working days. Refunds follow our refund policy." : undefined}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          {dialog === "complete" && (
            <fieldset>
              <legend className={label}>Rating</legend>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setRating(n)}
                    className={`text-2xl ${n <= rating ? "text-amber-500" : "text-stone-300"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <textarea
            aria-label={dialog === "complete" ? "Comment" : dialog === "revision" ? "Changes" : "Problem"}
            rows={4}
            className={field}
            required={dialog !== "complete"}
            minLength={dialog === "dispute" ? 10 : dialog === "revision" ? 3 : undefined}
            value={text}
            placeholder={dialog === "complete" ? "A short comment (optional)" : dialog === "revision" ? "Be specific: which parts, and how" : "What went wrong?"}
            onChange={(e) => setText(e.target.value)}
          />
          {act.error && <p className="text-sm text-red-600">{act.error.message}</p>}
          <button type="submit" className={dialog === "dispute" ? btn.danger : btn.primary} disabled={act.isPending}>
            {dialog === "complete" ? "Complete the order" : dialog === "revision" ? "Send to the expert" : "Send report"}
          </button>
        </form>
      </Dialog>
    </section>
  );
}

function Messages({ o }: { o: OrderDto }) {
  const qc = useQueryClient();
  const enabled = o.status !== "pending_payment" && o.status !== "cancelled";
  const messages = useOrderMessages(o.id, enabled);
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: () => api.post<OrderMessageDto>(`/orders/${o.id}/messages`, { body }),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: serviceKeys.messages(o.id) });
    },
  });
  return (
    <aside className={`${card} flex h-fit flex-col p-4 lg:sticky lg:top-20`}>
      <h2 className="text-sm font-semibold text-stone-900">Messages</h2>
      {!enabled ? (
        <p className="mt-2 text-sm text-stone-500">Messages open once the order is paid.</p>
      ) : (
        <>
          <ul className="mt-3 flex max-h-[50dvh] flex-col gap-2 overflow-y-auto" aria-label="Messages">
            {messages.data?.map((m) => (
              <li key={m.id} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${m.mine ? "ms-auto bg-brand text-white" : "bg-stone-100 text-stone-800"}`}>
                {!m.mine && <div className="text-[11px] font-semibold opacity-70">{m.authorName}</div>}
                <div className="whitespace-pre-line">{m.body}</div>
                <div className="mt-0.5 text-[10px] opacity-60">{when(m.createdAt)}</div>
              </li>
            ))}
            {messages.data?.length === 0 && <li className="text-sm text-stone-500">No messages yet. Questions about the {SERVICE_LABEL[o.kind] ?? "order"}? Ask here.</li>}
          </ul>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) send.mutate();
            }}
          >
            <textarea aria-label="Message" rows={3} className={field} value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />
            {send.error && <p className="text-xs text-red-600">{send.error.message}</p>}
            <button type="submit" className={`${btn.secondary} self-end`} disabled={send.isPending || !body.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </aside>
  );
}
