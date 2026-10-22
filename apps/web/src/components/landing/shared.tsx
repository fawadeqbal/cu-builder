"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@cvb/ui";
import { useHydrated } from "@/lib/hydrated";
import { useT } from "@/lib/i18n";
import { useMe } from "@/lib/queries";

/** Page width and side padding for every landing section. */
export const wrap = "mx-auto w-full max-w-(--layout-lg) px-4 sm:px-6";

/*
 * Arabic and Urdu: no negative letter-spacing (it breaks joined letters) and, for Nastaliq,
 * taller lines. Explicit `leading-*` classes win over the body's Urdu line height, so text
 * styled here carries these too.
 */
export const rtlHead = "[&:lang(ar)]:tracking-normal [&:lang(ur)]:tracking-normal [&:lang(ur)]:leading-[1.75]";
export const rtlBody = "[&:lang(ur)]:leading-[2]";
/** Small body copy used across the landing sections. */
export const bodyText = `text-sm leading-6 text-ink-2 ${rtlBody}`;

/** Where the main buttons go: straight into the builder, or to My CVs once signed in. */
export function useStart() {
  const t = useT();
  const me = useMe();
  const signedIn = useHydrated() && Boolean(me.data);
  return {
    signedIn,
    primary: signedIn
      ? { href: "/app", label: t("landing.start.myCvs") }
      : { href: "/builder", label: t("landing.start.build") },
    ai: signedIn ? "/new" : "/sign-up?next=%2Fnew",
    importHref: signedIn ? "/app?import=1" : "/sign-up?next=%2Fapp%3Fimport%3D1",
  };
}

export function SectionHead({
  id,
  eyebrow,
  title,
  lead,
  center,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`flex max-w-2xl flex-col gap-3 ${center ? "mx-auto items-center text-center" : ""}`}>
      <span className="cvb-overline text-brand-ink">{eyebrow}</span>
      <h2
        id={id}
        className={`font-display text-[28px] font-[720] leading-[34px] tracking-[-0.02em] text-balance text-ink sm:text-[36px] sm:leading-[42px] ${rtlHead}`}
      >
        {title}
      </h2>
      {lead && <p className={`text-base leading-[26px] text-pretty text-ink-2 ${rtlBody}`}>{lead}</p>}
    </div>
  );
}

export function FeatureIcon({ name, tone = "brand" }: { name: IconName; tone?: "brand" | "gold" }) {
  return (
    <span
      className={`grid size-11 shrink-0 place-items-center rounded-lg ${tone === "gold" ? "bg-gold-soft text-gold-ink" : "bg-brand-soft text-brand-ink"}`}
    >
      <Icon name={name} size={20} />
    </span>
  );
}

export function Check({ children }: { children: ReactNode }) {
  return (
    <li className={`flex items-start gap-2.5 ${bodyText}`}>
      <Icon name="check" size={16} className="mt-1 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}

/** Formats a count with Latin digits in every interface language, so figures match the rest of the page. */
export const formatCount = (n: number, locale: string) => new Intl.NumberFormat(`${locale}-u-nu-latn`).format(n);
