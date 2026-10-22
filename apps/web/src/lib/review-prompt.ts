/**
 * Remembers in this browser that we've asked for a review, so the prompt shows once. Storage can
 * be blocked (private windows); then we treat it as already asked rather than nag every time.
 */
export const REVIEW_PROMPT_KEY = "cvb-review-prompt";

type Store = Pick<Storage, "getItem" | "setItem">;
const store = (): Store | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function reviewPromptSeen(s: Store | null = store()): boolean {
  if (!s) return true;
  try {
    return s.getItem(REVIEW_PROMPT_KEY) !== null;
  } catch {
    return true;
  }
}

/** `how` is kept for curiosity only; any value means "don't ask again". */
export function markReviewPromptSeen(how: "shown" | "dismissed" | "reviewed", s: Store | null = store()): void {
  try {
    s?.setItem(REVIEW_PROMPT_KEY, how);
  } catch {
    // Storage full or blocked: nothing to do.
  }
}
