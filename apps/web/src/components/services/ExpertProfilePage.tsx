"use client";

import type { ServiceKind } from "@cvb/domain";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BackLink, Button, Card, KeyValue } from "@cvb/ui";
import { useMe } from "@/lib/queries";
import { SERVICE_LABEL, money, turnaround, useCatalog, useExpert } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { FullPageMessage } from "../ui/FullPageMessage";
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
  const facts = [
    e.specialties.length > 0 && { label: "Specialties", value: e.specialties.join(", ") },
    e.languages.length > 0 && { label: "Languages", value: e.languages.join(", ") },
    { label: "Time zone", value: e.timezone },
  ].filter((f): f is { label: string; value: string } => Boolean(f));

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-(--layout-md) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
        <BackLink href="/experts">Experts</BackLink>
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section className="cvb-card flex min-w-0 flex-col gap-6 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <Avatar name={e.displayName} photoUrl={e.photoUrl} />
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="cvb-h1 text-ink">{e.displayName}</h1>
                {e.headline && <p className="text-ink-2">{e.headline}</p>}
                <div className="mt-1">
                  <Stars avg={e.ratingAvg} count={e.ratingCount} />
                </div>
              </div>
            </div>
            {e.bio && <p className="whitespace-pre-line text-base leading-relaxed text-ink-2">{e.bio}</p>}
            <KeyValue items={facts} className="border-t border-line pt-5" />
          </section>
          <aside className="flex flex-col gap-4" aria-label="Services">
            {offers.map((s) => (
              <Card key={s.kind} as="div">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="cvb-h3 text-ink">{s.name}</h2>
                  <span className="cvb-price shrink-0">
                    {s.kind === "coaching" ? `from ${money(5900)}` : money(s.priceCents)}
                  </span>
                </div>
                <p className="cvb-caption -mt-2">
                  {SERVICE_LABEL[s.service]} · {turnaround(s.turnaroundHours)}
                </p>
                {me.data ? (
                  <Button variant="primary" block onClick={() => setBooking(s.kind)}>
                    Book
                  </Button>
                ) : (
                  <Button block href={`/sign-in?next=${encodeURIComponent(path)}`}>
                    Sign in to book
                  </Button>
                )}
              </Card>
            ))}
          </aside>
        </div>
      </main>
      {booking && <BookDialog open onClose={() => setBooking(null)} expert={e} initialKind={booking} />}
    </div>
  );
}
