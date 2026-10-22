"use client";

import { Button, IconButton, Icon } from "@cvb/ui";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import { canAskForReview, markReviewPromptSeen, useMyReview } from "@/lib/trust";
import { Dialog } from "../ui/Dialog";
import { ReviewForm } from "./ReviewForm";

const DELAY_MS = 1800;

/**
 * After a successful PDF download, a small card asks once for a review. It doesn't block the
 * editor or take focus; dismissing it (or seeing it once) means it never comes back in this
 * browser, and people who already wrote a review aren't asked. Guests are asked to sign in.
 */
export function useReviewPrompt(signedIn: boolean): { afterDownload: () => void; element: ReactNode } {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const mine = useMyReview(signedIn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const afterDownload = useCallback(() => {
    // Signed in but we don't know yet whether they've reviewed: ask another time.
    if (signedIn && !mine.data) return;
    if (!canAskForReview(Boolean(mine.data?.review))) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      markReviewPromptSeen("shown");
      setOpen(true);
    }, DELAY_MS);
  }, [signedIn, mine.data]);

  const close = (how: "dismissed" | "reviewed") => {
    markReviewPromptSeen(how);
    setOpen(false);
  };

  const element = (
    <>
      {open && !writing && (
        <PromptCard signedIn={signedIn} onWrite={() => setWriting(true)} onDismiss={() => close("dismissed")} />
      )}
      {signedIn && <WriteDialog open={writing} onClose={() => (setWriting(false), close("reviewed"))} />}
    </>
  );
  return { afterDownload, element };
}

function PromptCard({
  signedIn,
  onWrite,
  onDismiss,
}: {
  signedIn: boolean;
  onWrite: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  return (
    <aside
      aria-label={t("review.promptLabel")}
      className="no-print fixed inset-x-4 bottom-36 z-[var(--z-toast)] flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-lg)] lg:inset-x-auto lg:bottom-6 lg:start-6 lg:w-[360px]"
    >
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold-ink"
        aria-hidden="true"
      >
        <Icon name="star" size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-semibold text-ink [&:lang(ur)]:leading-[1.9]">{t("review.promptTitle")}</p>
        <p className="text-sm text-ink-2 [&:lang(ur)]:leading-[1.9]">
          {signedIn ? t("review.promptText") : t("review.promptGuest")}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {signedIn ? (
            <Button size="sm" variant="primary" icon="star" onClick={onWrite}>
              {t("review.promptWrite")}
            </Button>
          ) : (
            <Button size="sm" variant="primary" href="/sign-in?next=%2Fwrite-review">
              {t("review.promptSignIn")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            {t("review.promptLater")}
          </Button>
        </div>
      </div>
      <IconButton icon="x" size="sm" label={t("ui.dismiss")} onClick={onDismiss} />
    </aside>
  );
}

function WriteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const me = useMe();
  const mine = useMyReview(true);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mine.data?.review ? t("review.editTitle") : t("review.title")}
      description={t("review.intro")}
    >
      {open && mine.data && (
        <ReviewForm review={mine.data.review} accountName={me.data?.name ?? ""} onCancel={onClose} />
      )}
    </Dialog>
  );
}
