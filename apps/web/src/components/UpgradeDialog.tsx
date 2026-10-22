"use client";

import Link from "next/link";
import { Button, Icon } from "@cvb/ui";
import { usePlan } from "@/lib/access";
import { gateTitle, PLAN_LABEL, PLAN_POINTS, planForGate, type Gate } from "@/lib/plans";
import { Dialog } from "./ui/Dialog";

/** The one upgrade prompt: says what the locked thing needs and offers the way there, never a dead end. */
export function UpgradeDialog({ gate, onClose }: { gate: Gate | null; onClose: () => void }) {
  const { signedIn } = usePlan();
  if (!gate) return null;
  const plan = planForGate(gate);
  const pricing = gate.kind === "credits" ? "/pricing#credits" : `/pricing?plan=${plan}`;
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={gateTitle(gate)}
      description={
        gate.kind === "credits"
          ? "Credits reset on the 1st of each month. Buy a pack of 100, or upgrade for more every month."
          : signedIn
            ? `Upgrade to ${PLAN_LABEL[plan]}, or get a Job-Hunt Pass for a week or a month.`
            : "It's free and takes a minute; the CV you started here comes with you."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          {signedIn ? (
            <Button variant="primary" href={pricing}>
              {gate.kind === "credits" ? "Get more credits" : "See plans"}
            </Button>
          ) : (
            <Button variant="primary" href={`/sign-up?next=${encodeURIComponent(gate.kind === "account" ? "/app" : pricing)}`}>
              Create free account
            </Button>
          )}
        </>
      }
    >
      <p className="cvb-overline mb-2">{PLAN_LABEL[plan]} includes</p>
      <ul className="flex flex-col gap-2">
        {PLAN_POINTS[plan].map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-ink-2">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-success" /> {p}
          </li>
        ))}
      </ul>
      {!signedIn && (
        <p className="mt-4 text-sm text-ink-3">
          Already have an account?{" "}
          <Link href={`/sign-in?next=${encodeURIComponent(pricing)}`} className="font-medium text-brand-ink hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </Dialog>
  );
}
