"use client";

import type { OrderDto, OrderMessageDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Card, KeyValue, PageHeader, Stars, TextArea, Timeline as DsTimeline } from "@cvb/ui";
import { api } from "@/lib/api";
import { SERVICE_LABEL, money, serviceKeys, useCatalog, useOrder, useOrderMessages, when } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { Dialog } from "../ui/Dialog";
import { FullPageMessage } from "../ui/FullPageMessage";
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
      method === "put"
        ? api.put<OrderDto>(`/orders/${id}/${path}`, body)
        : api.post<OrderDto>(`/orders/${id}/${path}`, body ?? {}),
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
  const back =
    o.viewerRole === "expert"
      ? { href: "/expert", label: "Expert workspace" }
      : o.viewerRole === "admin"
        ? { href: "/admin", label: "Admin" }
        : { href: "/orders", label: "Expert orders" };
  type Fact = { label: string; value: ReactNode };
  const facts = (
    [
      { label: "Price", value: o.included ? "Included in plan" : money(o.priceCents, o.currency) },
      o.expertCents !== null && {
        label: "Expert's share",
        value: `${money(o.expertCents, o.currency)}${o.paidOut ? " · paid out" : ""}`,
      },
      o.dueAt && o.kind !== "coaching" && { label: "Due", value: when(o.dueAt) },
      o.scheduledAt && { label: "Session", value: `${when(o.scheduledAt)} · ${o.durationMin} min` },
      o.revisionsIncluded > 0 && { label: "Revisions", value: `${o.revisionsUsed} of ${o.revisionsIncluded} used` },
      o.rating ? { label: "Rating", value: <Stars value={o.rating} size={14} /> } : null,
    ] as (Fact | false | null | "" | undefined)[]
  ).filter((f): f is Fact => Boolean(f));

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
        <PageHeader
          back={back}
          title={o.name}
          description={
            <>
              {o.viewerRole === "expert"
                ? `For ${o.buyer.name}`
                : o.expert
                  ? `With ${o.expert.displayName}`
                  : "We're matching you with an expert"}
              {o.resumeTitle && ` · ${o.resumeTitle}`}
            </>
          }
          actions={<StatusBadge status={o.status} />}
        />
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex min-w-0 flex-col gap-6">
            {params.get("paid") && o.status !== "pending_payment" && (
              <Alert tone="success">Payment received. Thank you.</Alert>
            )}
            {params.get("cancelled") && o.status === "pending_payment" && (
              <Alert tone="warning">Payment was cancelled. You can try again from the expert&apos;s page.</Alert>
            )}
            <Card title="Order details">
              <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                <KeyValue items={facts} className="content-start self-start" />
                <Timeline o={o} />
              </div>
            </Card>

            {o.meetingUrl && (
              <Card title="Video call">
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" href={o.meetingUrl} target="_blank" rel="noreferrer noopener">
                    Join the call
                  </Button>
                  {o.calendarUrl && (
                    <Button href={o.calendarUrl} target="_blank" rel="noreferrer noopener" icon="calendar">
                      Add to Google Calendar
                    </Button>
                  )}
                  <Button variant="ghost" href={`/api/v1/orders/${o.id}/calendar`} download icon="download">
                    Download .ics
                  </Button>
                </div>
              </Card>
            )}

            {o.resumeId && (
              <Card as="div">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="min-w-0 flex-1 text-ink-2">
                    {o.viewerRole === "buyer"
                      ? "The expert's comments appear next to your CV lines in the editor."
                      : "Comment on the CV line by line; the customer sees your notes in their editor."}
                  </p>
                  {o.viewerRole === "buyer" ? (
                    <Button href={`/edit/${o.resumeId}`} icon="file">
                      Open my CV
                    </Button>
                  ) : (
                    <Button href={`/review/${o.resumeId}`} icon="edit">
                      Review the CV
                    </Button>
                  )}
                </div>
              </Card>
            )}

            <Intake o={o} />
            <Delivery o={o} />
            {o.viewerRole === "expert" && <ExpertActions o={o} />}
            {o.viewerRole === "buyer" && <BuyerActions o={o} />}
            {o.viewerRole === "admin" && <AdminOrderActions order={o} />}
            {o.dispute && (
              <Card title="Dispute">
                <p className="text-ink-2">{o.dispute.reason}</p>
                {o.dispute.resolution && <p className="text-ink-2">Resolution: {o.dispute.resolution}</p>}
              </Card>
            )}
          </div>
          <Messages o={o} />
        </div>
      </main>
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
  const open = !["cancelled", "refunded"].includes(o.status);
  const current = open ? steps.findIndex((s) => !s.at) : -1;
  return (
    <div aria-label="Progress" role="group">
      <DsTimeline
        items={steps.map((s, i) => ({
          title: s.name,
          meta: s.at ? new Date(s.at).toLocaleDateString() : undefined,
          state: s.at ? "done" : i === current ? "current" : "todo",
        }))}
      />
    </div>
  );
}

function Intake({ o }: { o: OrderDto }) {
  const catalog = useCatalog();
  const questions = catalog.data?.find((s) => s.kind === o.kind)?.intake ?? [];
  const answered = questions.filter((q) => o.intake[q.key]);
  if (!answered.length) return null;
  return (
    <Card title={o.viewerRole === "expert" ? "What the customer told us" : "Your answers"}>
      <dl className="flex flex-col gap-3">
        {answered.map((q) => (
          <div key={q.key} className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-ink-3">{q.label}</dt>
            <dd className="whitespace-pre-line text-ink">{o.intake[q.key]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Delivery({ o }: { o: OrderDto }) {
  if (!o.deliveryNote || o.viewerRole === "expert") return null;
  return (
    <Card title={o.kind === "coaching" ? "Session notes" : "From your expert"}>
      <p className="whitespace-pre-line text-base leading-relaxed text-ink">{o.deliveryNote}</p>
    </Card>
  );
}

function ExpertActions({ o }: { o: OrderDto }) {
  const act = useOrderAction(o.id);
  const [note, setNote] = useState(o.deliveryNote);
  const open = o.status === "paid" || o.status === "in_progress";
  const coaching = o.kind === "coaching";
  return (
    <Card
      title={coaching ? "Session notes" : "Your delivery"}
      actions={
        o.status === "paid" && !coaching ? (
          <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ path: "start" })}>
            Start working
          </Button>
        ) : undefined
      }
    >
      <TextArea
        aria-label={coaching ? "Session notes" : "Delivery note"}
        rows={6}
        value={note}
        maxLength={10_000}
        placeholder={
          coaching
            ? "What you covered, and the next steps you agreed"
            : "A summary of your changes and advice. Line comments go on the CV itself."
        }
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {open && (
          <Button
            variant="primary"
            disabled={act.isPending || !note.trim()}
            onClick={() => act.mutate({ path: "deliver", body: { note } })}
          >
            {coaching ? "Share notes and finish" : "Deliver to the customer"}
          </Button>
        )}
        <Button
          disabled={act.isPending || note === o.deliveryNote}
          onClick={() => act.mutate({ path: "notes", body: { notes: note }, method: "put" })}
        >
          Save without delivering
        </Button>
      </div>
      {act.error && <Alert tone="danger">{act.error.message}</Alert>}
    </Card>
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
      <Card as="div">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-ink-2">This order hasn&apos;t been paid.</p>
          <Button onClick={() => act.mutate({ path: "cancel" })}>Cancel order</Button>
        </div>
      </Card>
    );
  }
  if (o.status !== "delivered" && !canDispute) return null;
  return (
    <Card as="div">
      {o.status === "delivered" && <p className="text-ink-2">Happy with it? Accept and rate, or ask for changes.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {o.status === "delivered" && (
          <>
            <Button variant="primary" icon="star" onClick={() => setDialog("complete")}>
              Accept and rate
            </Button>
            {o.revisionsUsed < o.revisionsIncluded && (
              <Button onClick={() => setDialog("revision")}>
                Ask for changes ({o.revisionsIncluded - o.revisionsUsed} left)
              </Button>
            )}
          </>
        )}
        {canDispute && (
          <Button variant="ghost" icon="flag" className="ms-auto" onClick={() => setDialog("dispute")}>
            Report a problem
          </Button>
        )}
      </div>
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === "complete"
            ? "Rate your expert"
            : dialog === "revision"
              ? "What should change?"
              : "Report a problem"
        }
        description={
          dialog === "dispute"
            ? "Our team reviews every report within two working days. Refunds follow our refund policy."
            : undefined
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          {dialog === "complete" && (
            <fieldset className="cvb-fieldset">
              <legend className="cvb-legend">Rating</legend>
              <Stars value={rating} onRate={setRating} size={22} label="Rating" />
            </fieldset>
          )}
          <TextArea
            aria-label={dialog === "complete" ? "Comment" : dialog === "revision" ? "Changes" : "Problem"}
            rows={4}
            required={dialog !== "complete"}
            minLength={dialog === "dispute" ? 10 : dialog === "revision" ? 3 : undefined}
            value={text}
            placeholder={
              dialog === "complete"
                ? "A short comment (optional)"
                : dialog === "revision"
                  ? "Be specific: which parts, and how"
                  : "What went wrong?"
            }
            onChange={(e) => setText(e.target.value)}
          />
          {act.error && <Alert tone="danger">{act.error.message}</Alert>}
          <div className="flex justify-end">
            <Button type="submit" variant={dialog === "dispute" ? "danger" : "primary"} loading={act.isPending}>
              {dialog === "complete"
                ? "Complete the order"
                : dialog === "revision"
                  ? "Send to the expert"
                  : "Send report"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
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
    <Card as="div" title="Messages" className="h-fit lg:sticky lg:top-6">
      {!enabled ? (
        <p className="text-ink-3">Messages open once the order is paid.</p>
      ) : (
        <>
          <ul className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto" aria-label="Messages">
            {messages.data?.map((m) => (
              <li
                key={m.id}
                className={`flex max-w-[90%] flex-col gap-0.5 rounded-lg px-3 py-2 ${m.mine ? "ms-auto bg-brand-soft text-ink" : "me-auto bg-surface-2 text-ink"}`}
              >
                {!m.mine && <span className="text-xs font-semibold text-ink-2">{m.authorName}</span>}
                <span className="whitespace-pre-line">{m.body}</span>
                <span className="cvb-caption">{when(m.createdAt)}</span>
              </li>
            ))}
            {messages.data?.length === 0 && (
              <li className="text-ink-3">
                No messages yet. Questions about the {SERVICE_LABEL[o.kind] ?? "order"}? Ask here.
              </li>
            )}
          </ul>
          <form
            className="flex flex-col gap-2 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) send.mutate();
            }}
          >
            <TextArea
              aria-label="Message"
              rows={3}
              value={body}
              maxLength={8000}
              onChange={(e) => setBody(e.target.value)}
            />
            {send.error && <Alert tone="danger">{send.error.message}</Alert>}
            <Button type="submit" icon="message" className="self-end" disabled={send.isPending || !body.trim()}>
              Send
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}
