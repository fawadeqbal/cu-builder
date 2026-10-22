"use client";

import type { RedirectDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { api } from "@/lib/api";
import { PLAN_LABEL, PLAN_POINTS } from "@/lib/plans";
import { keys, useBillingStatus } from "@/lib/queries";
import { Alert, Button, Icon, KeyValue, ProgressBar, Skeleton } from "@cvb/ui";
import { useCredits } from "@/lib/ai";
import { AccountLayout, Section } from "./AccountLayout";

const SOURCE = {
  base: "",
  subscription: "through your subscription",
  pass: "with a Job-Hunt Pass",
  organization: "through your organisation",
} as const;

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
  const sub = s?.subscription;
  return (
    <>
      {success && (
        <Alert tone="success" title="Thank you. Your payment went through.">
          A receipt is on its way to your inbox.
        </Alert>
      )}
      <Section
        title="Your plan"
        footer={
          s && (
            <>
              {s.canManage && (
                <Button icon="credit" loading={portal.isPending} onClick={() => portal.mutate()}>
                  {s.subscription && !s.subscription.cancelAtPeriodEnd
                    ? "Manage or cancel subscription"
                    : "Manage billing, invoices and card"}
                </Button>
              )}
              <Button variant="primary" href="/pricing">
                {s.plan === "free" ? "See plans" : "Change plan or buy a pass"}
              </Button>
            </>
          )
        }
      >
        {!s ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading">
            <Skeleton width="40%" height={28} />
            <Skeleton width="70%" />
            <Skeleton width="60%" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-display text-[28px]/[34px] font-bold tracking-tight text-ink">
                {PLAN_LABEL[s.plan]}
              </span>
              {SOURCE[s.source] && <span className="text-ink-3">{SOURCE[s.source]}</span>}
            </div>
            {(sub || s.pass) && (
              <KeyValue
                items={[
                  ...(sub
                    ? [
                        { label: "Subscription", value: `${PLAN_LABEL[sub.plan]}, ${sub.status.replace("_", " ")}` },
                        {
                          label: sub.cancelAtPeriodEnd ? "Ends on" : "Renews on",
                          value: new Date(sub.currentPeriodEnd).toLocaleDateString(),
                        },
                      ]
                    : []),
                  ...(s.pass
                    ? [
                        {
                          label: "Pass",
                          value: `${PLAN_LABEL[s.pass.plan]} pass until ${new Date(s.pass.endsAt).toLocaleString()}`,
                        },
                      ]
                    : []),
                ]}
              />
            )}
            {sub?.status === "past_due" && (
              <Alert tone="warning">Your last payment failed; we&apos;ll retry it. Please update your card.</Alert>
            )}
            <div className="flex flex-col gap-2">
              <span className="cvb-overline">What&apos;s included</span>
              <ul className="cvb-pricing-list grid gap-2 sm:grid-cols-2">
                {PLAN_POINTS[s.plan].map((p) => (
                  <li key={p}>
                    <Icon name="check" size={16} /> {p}
                  </li>
                ))}
              </ul>
            </div>
            {portal.error && <Alert tone="danger">{portal.error.message}</Alert>}
          </div>
        )}
      </Section>
      <Credits />
    </>
  );
}

/** This month's AI credits: the allowance used so far and any bought packs. */
function Credits() {
  const credits = useCredits(true);
  const c = credits.data;
  if (!c) return null;
  return (
    <Section
      title="AI credits"
      description="Used for AI writing, tailoring and interview feedback."
      actions={
        <Button variant="link" size="sm" iconEnd="arrow-right" href="/pricing#credits">
          Buy credits
        </Button>
      }
    >
      <ProgressBar
        value={c.usedThisMonth}
        max={c.allowance}
        tone={c.remaining === 0 ? "warning" : "brand"}
        label="Used this month"
        valueLabel={<bdi>{`${c.usedThisMonth} of ${c.allowance}`}</bdi>}
      />
      <KeyValue
        items={[
          { label: "Left", value: <span className="cvb-num">{c.remaining}</span> },
          { label: "Bought packs", value: <span className="cvb-num">{c.purchasedLeft}</span> },
          { label: "Resets on", value: new Date(c.resetsAt).toLocaleDateString() },
        ]}
      />
    </Section>
  );
}
