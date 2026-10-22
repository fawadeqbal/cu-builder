/**
 * Rules for user reviews shown on the landing page. One review per account, editable; every new
 * or edited review waits for a moderator, who approves genuine reviews (good or bad) and rejects
 * only spam, abuse or personal data.
 */

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_TEXT_MIN = 10;
export const REVIEW_TEXT_MAX = 600;
export const REVIEW_NAME_MAX = 60;
export const REVIEW_TITLE_MAX = 80;

export type ReviewInput = { rating: number; text: string; displayName: string; jobTitle?: string | null };

/** The first problem with a review, in plain words, or null when it can be saved. */
export function reviewProblem(input: ReviewInput): string | null {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    return "Choose a rating from 1 to 5 stars.";
  const text = input.text.trim();
  if (text.length < REVIEW_TEXT_MIN) return `Write at least ${REVIEW_TEXT_MIN} characters.`;
  if (text.length > REVIEW_TEXT_MAX) return `Keep it to ${REVIEW_TEXT_MAX} characters.`;
  const name = input.displayName.trim();
  if (!name) return "Add the name to show with your review.";
  if (name.length > REVIEW_NAME_MAX) return `Keep the name to ${REVIEW_NAME_MAX} characters.`;
  if ((input.jobTitle ?? "").trim().length > REVIEW_TITLE_MAX)
    return `Keep the job title to ${REVIEW_TITLE_MAX} characters.`;
  if (/https?:\/\/|www\./i.test(text)) return "Leave links out of your review.";
  return null;
}

/** Trims the fields and turns an empty job title into null. */
export function cleanReview(input: ReviewInput): Required<Omit<ReviewInput, "jobTitle">> & { jobTitle: string | null } {
  const jobTitle = (input.jobTitle ?? "").trim();
  return {
    rating: input.rating,
    text: input.text.trim(),
    displayName: input.displayName.trim(),
    jobTitle: jobTitle || null,
  };
}

/**
 * A privacy-friendly name to suggest: first name and the initial of the last one
 * ("Sara Ahmed" → "Sara A."). Falls back to "" so the person types one.
 */
export function suggestDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0]!.slice(0, REVIEW_NAME_MAX - 3);
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  return last ? `${first} ${Array.from(last)[0]!.toUpperCase()}.` : first;
}

/** Status after the author saves: new reviews and changed ones wait for moderation again. */
export function statusAfterSave(
  previous: { status: ReviewStatus; rating: number; text: string; displayName: string; jobTitle: string | null } | null,
  next: ReviewInput,
): ReviewStatus {
  if (!previous) return "pending";
  const n = cleanReview(next);
  const same =
    previous.rating === n.rating &&
    previous.text === n.text &&
    previous.displayName === n.displayName &&
    previous.jobTitle === n.jobTitle;
  return same ? previous.status : "pending";
}

/** Moderators can approve or reject from any state (and change their mind); nothing goes back to pending by hand. */
export const canModerateTo = (to: ReviewStatus): to is "approved" | "rejected" =>
  to === "approved" || to === "rejected";

/** Whether to ask for a review after a download: once per browser, never after a dismissal or once they've written one. */
export const shouldAskForReview = (s: { alreadyAsked: boolean; hasReview: boolean }): boolean =>
  !s.alreadyAsked && !s.hasReview;
