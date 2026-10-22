"use client";

import type { ReviewDto, SaveReviewDto } from "@cvb/contracts";
import {
  REVIEW_NAME_MAX,
  REVIEW_TEXT_MAX,
  REVIEW_TEXT_MIN,
  REVIEW_TITLE_MAX,
  reviewProblem,
  suggestDisplayName,
} from "@cvb/domain";
import { Alert, Button, Field, Stars, TextArea, TextField } from "@cvb/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { trustKeys } from "@/lib/trust";

type Props = {
  /** The user's current review, to edit. */
  review: ReviewDto | null;
  /** The account name, used to suggest a short display name. */
  accountName: string;
  onSaved?: (review: ReviewDto) => void;
  onCancel?: () => void;
};

/** Write or edit your one review. It shows on the site after a moderator approves it. */
export function ReviewForm({ review, accountName, onSaved, onCancel }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [text, setText] = useState(review?.text ?? "");
  const [displayName, setDisplayName] = useState(review?.displayName ?? suggestDisplayName(accountName));
  const [jobTitle, setJobTitle] = useState(review?.jobTitle ?? "");
  const [tried, setTried] = useState(false);

  const save = useMutation({
    mutationFn: (dto: SaveReviewDto) => api.put<ReviewDto>("/reviews/me", dto),
    onSuccess: (saved) => {
      qc.setQueryData(trustKeys.myReview, { review: saved });
      onSaved?.(saved);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/reviews/me"),
    onSuccess: () => qc.setQueryData(trustKeys.myReview, { review: null }),
  });

  const dto: SaveReviewDto = {
    rating,
    text: text.trim(),
    displayName: displayName.trim(),
    jobTitle: jobTitle.trim() || null,
  };
  const ratingError = tried && !rating ? t("review.errRating") : undefined;
  const textError =
    tried && text.trim().length < REVIEW_TEXT_MIN ? t("review.errText", { n: REVIEW_TEXT_MIN }) : undefined;
  const nameError = tried && !displayName.trim() ? t("review.errName") : undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (reviewProblem(dto)) return;
    save.mutate(dto);
  }

  const saved = save.data ?? null;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {saved && (
        <Alert tone="success" title={t("review.thanks")}>
          {saved.status === "approved" ? t("review.live") : t("review.pendingNote")}
        </Alert>
      )}
      {review && !saved && review.status !== "approved" && (
        <Alert tone="info">{review.status === "rejected" ? t("review.rejectedNote") : t("review.pendingNote")}</Alert>
      )}
      <Field label={t("review.rating")} error={ratingError} required>
        <Stars value={rating} onRate={setRating} label={t("review.rating")} />
      </Field>
      <TextArea
        label={t("review.text")}
        hint={t("review.textHint")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={REVIEW_TEXT_MAX}
        rows={5}
        dir="auto"
        error={textError}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("review.name")}
          hint={t("review.nameHint")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={REVIEW_NAME_MAX}
          dir="auto"
          error={nameError}
          required
        />
        <TextField
          label={t("review.jobTitle")}
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          maxLength={REVIEW_TITLE_MAX}
          dir="auto"
          optional
        />
      </div>
      {save.error && <Alert tone="danger">{save.error.message}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" loading={save.isPending}>
          {review ? t("review.update") : t("review.submit")}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        {review && (
          <Button variant="ghost" className="ms-auto" loading={remove.isPending} onClick={() => remove.mutate()}>
            {t("review.delete")}
          </Button>
        )}
      </div>
    </form>
  );
}
