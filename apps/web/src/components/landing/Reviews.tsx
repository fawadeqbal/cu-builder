"use client";

import type { PublicReviewDto } from "@cvb/contracts";
import { Stars } from "@cvb/ui";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { useApprovedReviews } from "@/lib/trust";
import { rtlBody, SectionHead, useStart, wrap } from "./shared";

/** Approved reviews from signed-in users. The whole section is hidden until there is at least one. */
export function Reviews() {
  const t = useT();
  const start = useStart();
  const reviews = useApprovedReviews(6).data?.items ?? [];
  if (!reviews.length) return null;
  return (
    <section aria-labelledby="reviews-title" className="pb-20">
      <div className={`${wrap} flex flex-col gap-10`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            id="reviews-title"
            eyebrow={t("landing.reviews.eyebrow")}
            title={t("landing.reviews.title")}
            lead={t("landing.reviews.lead")}
          />
          <Link
            href={start.signedIn ? "/write-review" : "/sign-in?next=%2Fwrite-review"}
            className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
          >
            {t("landing.reviews.write")}
          </Link>
        </div>
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: PublicReviewDto }) {
  const t = useT();
  return (
    <li className="mb-4 break-inside-avoid">
      <figure className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
        <Stars value={review.rating} label={t("landing.reviews.rated", { n: review.rating })} />
        {/* Reviews are written in any language: let the browser pick the direction per review. */}
        <blockquote dir="auto" className={`text-sm leading-6 text-pretty whitespace-pre-line text-ink ${rtlBody}`}>
          {review.text}
        </blockquote>
        <figcaption className="flex flex-col">
          <bdi className="text-sm font-semibold text-ink">{review.displayName}</bdi>
          {review.jobTitle && <bdi className="cvb-caption">{review.jobTitle}</bdi>}
        </figcaption>
      </figure>
    </li>
  );
}
