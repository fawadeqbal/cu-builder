"use client";

import type { ServiceKind } from "@cvb/domain";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/lib/queries";
import { SERVICE_LABEL, money, turnaround, useCatalog, useExpert } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { FullPageMessage } from "../ui/FullPageMessage";
import { btn, card } from "../ui/styles";
import { BookDialog } from "./BookDialog";
import { Avatar, Stars } from "./ExpertsPage";

/** One expert: who they are, what they offer, and booking. */
export function ExpertProfilePage({ id }: { id: string }) {
  const expert = useExpert(id);
  const catalog = useCatalog();
  const me = useMe();
  const path = usePathname();
  const [booking, setBooking] = useState<ServiceKind | null>(null);
  if (expert.isLoading) return <FullPageMessage>Loading…</FullPageMessage>;
  const e = expert.data;
  if (!e) return <FullPageMessage>This expert isn&apos;t available.</FullPageMessage>;
  const offers = (catalog.data ?? []).filter((s) => e.services.includes(s.service));

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[1fr_20rem]">
        <section className={`${card} p-6`}>
          <div className="flex items-start gap-4">
            <Avatar name={e.displayName} photoUrl={e.photoUrl} size="size-16" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-stone-900">{e.displayName}</h1>
              {e.headline && <p className="text-sm text-stone-600">{e.headline}</p>}
              <div className="mt-1">
                <Stars avg={e.ratingAvg} count={e.ratingCount} />
              </div>
            </div>
          </div>
          {e.bio && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-stone-700">{e.bio}</p>}
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            {e.specialties.length > 0 && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Specialties</dt>
                <dd className="text-stone-800">{e.specialties.join(", ")}</dd>
              </div>
            )}
            {e.languages.length > 0 && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Languages</dt>
                <dd className="text-stone-800">{e.languages.join(", ")}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Time zone</dt>
              <dd className="text-stone-800">{e.timezone}</dd>
            </div>
          </dl>
        </section>
        <aside className="flex flex-col gap-3">
          {offers.map((s) => (
            <div key={s.kind} className={`${card} p-4`}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900">{s.name}</h2>
                <span className="text-sm font-semibold text-stone-900">{s.kind === "coaching" ? `from ${money(5900)}` : money(s.priceCents)}</span>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                {SERVICE_LABEL[s.service]} · {turnaround(s.turnaroundHours)}
              </p>
              {me.data ? (
                <button type="button" className={`${btn.primary} mt-3 w-full`} onClick={() => setBooking(s.kind)}>
                  Book
                </button>
              ) : (
                <Link href={`/sign-in?next=${encodeURIComponent(path)}`} className={`${btn.secondary} mt-3 w-full`}>
                  Sign in to book
                </Link>
              )}
            </div>
          ))}
        </aside>
      </main>
      {booking && <BookDialog open onClose={() => setBooking(null)} expert={e} initialKind={booking} />}
    </div>
  );
}
