"use client";

import type { AdminReviewDto, Page } from "@cvb/contracts";
import type { ReviewStatus } from "@cvb/domain";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, EmptyState, SegmentedControl, Skeleton, Stars } from "@cvb/ui";
import { api } from "@/lib/api";
import { trustKeys } from "@/lib/trust";

const FILTERS = ["pending", "approved", "rejected", "all"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = {
  pending: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
};
const STATUS_TONE = { pending: "warning", approved: "success", rejected: "neutral" } as const;

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Moderate product reviews before they show on the landing page. */
export function ReviewsAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const reviews = useInfiniteQuery({
    queryKey: trustKeys.adminReviews(filter),
    initialPageParam: "",
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: "20" });
      if (filter !== "all") q.set("status", filter);
      if (pageParam) q.set("cursor", pageParam);
      return api.get<Page<AdminReviewDto>>(`/admin/reviews?${q}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<ReviewStatus, "pending"> }) =>
      api.patch<AdminReviewDto>(`/admin/reviews/${id}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      void qc.invalidateQueries({ queryKey: trustKeys.reviews });
    },
  });
  const items = reviews.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="cvb-h2">Reviews</h2>
        <SegmentedControl
          label="Show reviews"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ value: f, label: FILTER_LABEL[f] }))}
        />
      </div>
      <Alert tone="info">
        Approve every genuine review, good or bad. Reject only spam, abuse, or reviews that share personal details.
        Edited reviews come back here.
      </Alert>
      {moderate.error && <Alert tone="danger">{moderate.error.message}</Alert>}
      {!reviews.data ? (
        <Skeleton height={200} shape="block" />
      ) : items.length === 0 ? (
        <EmptyState icon="star" title={filter === "pending" ? "Nothing waiting" : "No reviews here"} size="sm" />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((r) => (
            <li key={r.id} className="cvb-card flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} label={`${r.rating} out of 5`} />
                <Badge tone={STATUS_TONE[r.status]}>{FILTER_LABEL[r.status]}</Badge>
                <span className="cvb-caption">
                  {date(r.createdAt)}
                  {r.updatedAt !== r.createdAt && ` · edited ${date(r.updatedAt)}`}
                </span>
              </div>
              <p dir="auto" className="whitespace-pre-line text-sm leading-6 text-ink">
                {r.text}
              </p>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <bdi className="text-sm font-semibold text-ink">
                    {r.displayName}
                    {r.jobTitle && <span className="font-normal text-ink-2"> · {r.jobTitle}</span>}
                  </bdi>
                  <span className="cvb-caption truncate" dir="ltr">
                    {r.userEmail}
                  </span>
                </div>
                <div className="flex gap-2">
                  {r.status !== "approved" && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon="check"
                      loading={
                        moderate.isPending &&
                        moderate.variables?.id === r.id &&
                        moderate.variables.status === "approved"
                      }
                      onClick={() => moderate.mutate({ id: r.id, status: "approved" })}
                    >
                      Approve
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button
                      size="sm"
                      icon="x"
                      loading={
                        moderate.isPending &&
                        moderate.variables?.id === r.id &&
                        moderate.variables.status === "rejected"
                      }
                      onClick={() => moderate.mutate({ id: r.id, status: "rejected" })}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {reviews.hasNextPage && (
        <Button
          className="self-center"
          loading={reviews.isFetchingNextPage}
          onClick={() => void reviews.fetchNextPage()}
        >
          Show more
        </Button>
      )}
    </section>
  );
}
