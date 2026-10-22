"use client";

import type { RedirectDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { api } from "@/lib/api";
import { PLAN_LABEL, PLAN_POINTS } from "@/lib/plans";
import { keys, useBillingStatus } from "@/lib/queries";
import { btn } from "../ui/styles";
import { AccountLayout, Section } from "./AccountLayout";

const SOURCE = { base: "", subscription: "through your subscription", pass: "with a Job-Hunt Pass", organization: "through your organisation" } as const;

export function BillingPage() {
  return <AccountLayout title="Account">{() => <Billing />}</AccountLayout>;
}

function Billing() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const success = params.get("checkout") === "success";
  const status = useBillingStatus();
  const portal = useMutation({
    mutationFn: () => api.post<RedirectDto>("/billing/portal"),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  // The payment webhook may land a moment after the redirect: refresh until the plan shows.
  useEffect(() => {
    if (!success) return;
    track("purchased");
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      void qc.invalidateQueries({ queryKey: keys.billing });
      void qc.invalidateQueries({ queryKey: keys.me });
      if (tries >= 10) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [success, qc]);

  const s = status.data;
  return (
    <>
      {success && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Thank you! Your payment went through. A receipt is on its way to your inbox.
        </div>
      )}
      <Section title="Your plan">
        {!s ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-semibold text-stone-900">{PLAN_LABEL[s.plan]}</span>
              {SOURCE[s.source] && <span className="text-sm text-stone-500">{SOURCE[s.source]}</span>}
            </div>
            <ul className="grid gap-1.5 text-sm text-stone-700 sm:grid-cols-2">
              {PLAN_POINTS[s.plan].map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
            {s.subscription && (
              <p className="text-sm text-stone-600">
                {PLAN_LABEL[s.subscription.plan]} subscription, {s.subscription.status.replace("_", " ")}.{" "}
                {s.subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} on {new Date(s.subscription.currentPeriodEnd).toLocaleDateString()}.
                {s.subscription.status === "past_due" && " Your last payment failed; we'll retry it. Please update your card."}
              </p>
            )}
            {s.pass && (
              <p className="text-sm text-stone-600">
                {PLAN_LABEL[s.pass.plan]} pass until {new Date(s.pass.endsAt).toLocaleString()}.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/pricing" className={btn.primary}>
                {s.plan === "free" ? "See plans" : "Change plan or buy a pass"}
              </Link>
              {s.canManage && (
                <button type="button" className={btn.secondary} disabled={portal.isPending} onClick={() => portal.mutate()}>
                  Manage billing, invoices and card
                </button>
              )}
            </div>
            {portal.error && <p className="text-sm text-red-600">{portal.error.message}</p>}
          </div>
        )}
      </Section>
    </>
  );
}
