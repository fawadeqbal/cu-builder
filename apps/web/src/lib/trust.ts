"use client";

import type { Page, PublicReviewDto, PublicStatsDto, ReviewDto, SiteSettingsDto } from "@cvb/contracts";
import { shouldAskForReview } from "@cvb/domain";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { markReviewPromptSeen, reviewPromptSeen } from "./review-prompt";

export { markReviewPromptSeen };

/** Query keys for trust features (stats, reviews, site settings). */
export const trustKeys = {
  stats: ["public", "stats"] as const,
  reviews: ["public", "reviews"] as const,
  myReview: ["reviews", "me"] as const,
  siteSettings: ["public", "site-settings"] as const,
  adminReviews: (status: string) => ["admin", "reviews", status] as const,
  adminSiteSettings: ["admin", "site-settings"] as const,
};

/** Real usage numbers (null under their thresholds). Failures just mean no stats line. */
export const usePublicStats = () =>
  useQuery({
    queryKey: trustKeys.stats,
    queryFn: () => api.get<PublicStatsDto>("/public/stats"),
    staleTime: 600_000,
    retry: false,
  });

/** The newest approved reviews. */
export const useApprovedReviews = (limit = 6) =>
  useQuery({
    queryKey: [...trustKeys.reviews, limit],
    queryFn: () => api.get<Page<PublicReviewDto>>(`/public/reviews?limit=${limit}`),
    staleTime: 300_000,
    retry: false,
  });

export const useMyReview = (enabled: boolean) =>
  useQuery({
    queryKey: trustKeys.myReview,
    queryFn: () => api.get<{ review: ReviewDto | null }>("/reviews/me"),
    enabled,
    staleTime: 300_000,
  });

/** Admin-managed settings: the WhatsApp help number. */
export const useSiteSettings = () =>
  useQuery({
    queryKey: trustKeys.siteSettings,
    queryFn: () => api.get<SiteSettingsDto>("/public/site-settings"),
    staleTime: 300_000,
    retry: false,
  });

/** Whether to show the review prompt now (asked once per browser; never once a review exists). */
export const canAskForReview = (hasReview: boolean): boolean =>
  shouldAskForReview({ alreadyAsked: reviewPromptSeen(), hasReview });
