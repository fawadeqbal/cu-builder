"use client";

import { Alert, Card, PageHeader, Skeleton } from "@cvb/ui";
import { useT } from "@/lib/i18n";
import { useMyReview } from "@/lib/trust";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { ReviewForm } from "./ReviewForm";

/** /write-review: write or edit your review (guests are sent to sign in first). */
export function WriteReviewPage() {
  const t = useT();
  return (
    <RequireAuth>
      {(me) => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
            <PageHeader title={t("review.title")} description={t("review.intro")} />
            <Card>
              <Loaded accountName={me.name} />
            </Card>
          </main>
        </div>
      )}
    </RequireAuth>
  );
}

function Loaded({ accountName }: { accountName: string }) {
  const t = useT();
  const mine = useMyReview(true);
  if (mine.isError) return <Alert tone="danger">{t("common.somethingWrong")}</Alert>;
  if (!mine.data) return <Skeleton height={220} shape="block" />;
  return <ReviewForm review={mine.data.review} accountName={accountName} />;
}
