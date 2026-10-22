"use client";

import type { ExpertDto, ServiceInfoDto } from "@cvb/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Avatar as DsAvatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
  Stars as DsStars,
  TextField,
} from "@cvb/ui";
import { useMe } from "@/lib/queries";
import { SERVICE_LABEL, money, turnaround, useCatalog, useExperts } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { BookDialog } from "./BookDialog";

/** An expert's rating with its count, or a "New" badge for experts without reviews yet. */
export function Stars({ avg, count }: { avg: number; count: number }) {
  if (!count) return <Badge tone="highlight">New</Badge>;
  return (
    <span className="cvb-expert-rating" aria-label={`Rated ${avg.toFixed(1)} out of 5 by ${count} customers`}>
      <DsStars value={avg} size={14} label={`Rated ${avg.toFixed(1)} out of 5`} />
      <span className="cvb-num font-semibold text-ink" aria-hidden>
        {avg.toFixed(1)}
      </span>
      <span className="cvb-num" aria-hidden>
        ({count})
      </span>
    </span>
  );
}

/** The expert's photo, or their initials. */
export function Avatar({
  name,
  photoUrl,
  size = "lg",
}: {
  name: string;
  photoUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  return <DsAvatar name={name} src={photoUrl} size={size} className="shrink-0" />;
}

/** The lowest price an expert offers, for "From $39" on the card. */
const priceOf = (s: ServiceInfoDto) => (s.kind === "coaching" ? 5900 : s.priceCents);
function fromPrice(e: ExpertDto, catalog: ServiceInfoDto[] | undefined) {
  const prices = (catalog ?? []).filter((s) => s.kind !== "review_rush" && e.services.includes(s.service)).map(priceOf);
  return prices.length ? Math.min(...prices) : null;
}

/** The marketplace front: services with prices, and the directory of approved experts. */
export function ExpertsPage() {
  const catalog = useCatalog();
  const me = useMe();
  const path = usePathname();
  const [service, setService] = useState("");
  const [language, setLanguage] = useState("");
  const [booking, setBooking] = useState<ExpertDto | null>(null);
  const experts = useExperts(service, language.trim());
  const filtered = Boolean(service || language.trim());

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-8 px-4 pb-20 pt-10 sm:px-6">
        <PageHeader
          title="Work with an expert"
          description="Vetted recruiters and career coaches review your CV line by line, write it for you, or coach you one to one."
          actions={
            <Button variant="link" href="/expert" iconEnd="arrow-right">
              Are you a career expert? Join us
            </Button>
          }
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Services">
          {catalog.isLoading
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i}>
                  <Skeleton height={148} shape="block" />
                </li>
              ))
            : catalog.data
                ?.filter((s) => s.kind !== "review_rush")
                .map((s) => (
                  <li key={s.kind} className="cvb-card flex flex-col gap-2 p-5">
                    <h2 className="cvb-h3 text-ink">{s.name}</h2>
                    <p className="flex-1 text-sm text-ink-2">{s.description}</p>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="cvb-price">
                        {s.kind === "coaching" ? `from ${money(5900)}` : money(s.priceCents)}
                      </span>
                      <span className="cvb-caption">{turnaround(s.turnaroundHours)}</span>
                    </p>
                  </li>
                ))}
        </ul>

        <section className="flex flex-col gap-4" aria-labelledby="experts-title">
          <div className="flex flex-col gap-3">
            <h2 id="experts-title" className="cvb-h2 text-ink">
              Experts
            </h2>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Service">
              <Chip selected={!service} onClick={() => setService("")}>
                Any service
              </Chip>
              {Object.entries(SERVICE_LABEL).map(([k, v]) => (
                <Chip key={k} selected={service === k} onClick={() => setService(service === k ? "" : k)}>
                  {v}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TextField
                size="sm"
                icon="languages"
                aria-label="Language"
                className="w-full sm:w-64"
                value={language}
                placeholder="Language, e.g. Urdu"
                onChange={(e) => setLanguage(e.target.value)}
              />
              {filtered && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setService("");
                    setLanguage("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {experts.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={196} shape="block" />
              ))}
            </div>
          ) : !experts.data?.length ? (
            <Card>
              <EmptyState
                icon="users"
                title={filtered ? "No experts match these filters" : "No experts match yet"}
                actions={
                  filtered ? (
                    <Button
                      onClick={() => {
                        setService("");
                        setLanguage("");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              >
                <p>You can still order a review: we&apos;ll match you with the first available expert.</p>
              </EmptyState>
            </Card>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Experts">
              {experts.data.map((e) => (
                <ExpertCard
                  key={e.userId}
                  expert={e}
                  from={fromPrice(e, catalog.data)}
                  book={me.data ? () => setBooking(e) : undefined}
                  signInHref={`/sign-in?next=${encodeURIComponent(path)}`}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
      {booking && <BookDialog open onClose={() => setBooking(null)} expert={booking} />}
    </div>
  );
}

function ExpertCard({
  expert: e,
  from,
  book,
  signInHref,
}: {
  expert: ExpertDto;
  from: number | null;
  book?: () => void;
  signInHref: string;
}) {
  return (
    <li className="cvb-expert relative transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-sm">
      <div className="cvb-expert-head">
        <Avatar name={e.displayName} photoUrl={e.photoUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="cvb-expert-name truncate">
            {/* The name links to the profile and stretches over the card; Book sits above it. */}
            <Link
              href={`/experts/${e.userId}`}
              className="after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:shadow-[var(--focus-ring)]"
            >
              {e.displayName}
            </Link>
          </h3>
          {e.headline && <p className="line-clamp-2 text-[13px] leading-[18px] text-ink-3">{e.headline}</p>}
          <span className="mt-1">
            <Stars avg={e.ratingAvg} count={e.ratingCount} />
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {e.services.map((s) => (
          <Badge key={s}>{SERVICE_LABEL[s] ?? s}</Badge>
        ))}
      </div>
      {e.languages.length > 0 && (
        <span className="cvb-caption flex items-center gap-1">
          <Icon name="languages" size={14} /> {e.languages.join(", ")}
        </span>
      )}
      <div className="cvb-expert-foot mt-auto">
        <span>
          {from !== null && (
            <>
              <span className="cvb-caption">From </span>
              <span className="cvb-price">{money(from)}</span>
            </>
          )}
        </span>
        {book ? (
          <Button variant="primary" size="sm" className="relative z-10" onClick={book}>
            Book
          </Button>
        ) : (
          <Button size="sm" className="relative z-10" href={signInHref}>
            Sign in to book
          </Button>
        )}
      </div>
    </li>
  );
}
