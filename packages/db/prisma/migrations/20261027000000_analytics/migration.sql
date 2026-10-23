-- AlterTable
ALTER TABLE "users" ADD COLUMN     "acquisition" JSONB;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "amount_cents" INTEGER,
ADD COLUMN     "canceled_at" TIMESTAMP(3),
ADD COLUMN     "interval" TEXT,
ADD COLUMN     "offer_id" TEXT;

-- AlterTable
ALTER TABLE "billing_events" ADD COLUMN     "offer" TEXT,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "analytics_events" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "device" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "referrer_domain" TEXT,
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "utm_campaign" TEXT,
ADD COLUMN     "utm_content" TEXT,
ADD COLUMN     "utm_medium" TEXT,
ADD COLUMN     "utm_source" TEXT,
ADD COLUMN     "utm_term" TEXT;

-- CreateTable
CREATE TABLE "analytics_visitors" (
    "anonymous_id" TEXT NOT NULL,
    "user_id" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT '(direct)',
    "medium" TEXT NOT NULL DEFAULT '(none)',
    "campaign" TEXT,
    "term" TEXT,
    "content" TEXT,
    "referrer_domain" TEXT,
    "landing_path" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "country" TEXT,
    "locale" TEXT,

    CONSTRAINT "analytics_visitors_pkey" PRIMARY KEY ("anonymous_id")
);

-- CreateTable
CREATE TABLE "mrr_movements" (
    "id" TEXT NOT NULL,
    "subscription_ref" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "before_cents" INTEGER NOT NULL,
    "after_cents" INTEGER NOT NULL,
    "delta_cents" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mrr_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_visitors_first_seen_at_idx" ON "analytics_visitors"("first_seen_at");

-- CreateIndex
CREATE INDEX "analytics_visitors_last_seen_at_idx" ON "analytics_visitors"("last_seen_at");

-- CreateIndex
CREATE INDEX "analytics_visitors_user_id_idx" ON "analytics_visitors"("user_id");

-- CreateIndex
CREATE INDEX "mrr_movements_currency_occurred_at_idx" ON "mrr_movements"("currency", "occurred_at");

-- CreateIndex
CREATE INDEX "mrr_movements_subscription_ref_idx" ON "mrr_movements"("subscription_ref");

-- CreateIndex
CREATE INDEX "mrr_movements_user_id_idx" ON "mrr_movements"("user_id");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "resumes_created_at_idx" ON "resumes"("created_at");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "billing_events_type_processed_at_idx" ON "billing_events"("type", "processed_at");

-- CreateIndex
CREATE INDEX "billing_events_user_id_idx" ON "billing_events"("user_id");

-- CreateIndex
CREATE INDEX "passes_created_at_idx" ON "passes"("created_at");

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- CreateIndex
CREATE INDEX "analytics_events_anonymous_id_created_at_idx" ON "analytics_events"("anonymous_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_created_at_idx" ON "analytics_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");

-- CreateIndex
CREATE INDEX "service_orders_paid_at_idx" ON "service_orders"("paid_at");

-- Events of accounts that no longer exist lose their user id (the foreign key below needs it,
-- and it keeps deleted accounts out of analytics).
UPDATE "analytics_events" SET "user_id" = NULL
WHERE "user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "analytics_events"."user_id");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_visitors" ADD CONSTRAINT "analytics_visitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrr_movements" ADD CONSTRAINT "mrr_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill ------------------------------------------------------------------

-- Server-side sign-up events used the user id as their anonymous id; they now use "u:<id>".
UPDATE "analytics_events" SET "anonymous_id" = 'u:' || "user_id"
WHERE "name" = 'signed_up' AND "user_id" IS NOT NULL AND "anonymous_id" = "user_id";

-- One visitor row per browser that has sent events, linked to the account it was used with.
INSERT INTO "analytics_visitors" ("anonymous_id", "user_id", "first_seen_at", "last_seen_at")
SELECT e."anonymous_id",
       (array_agg(e."user_id" ORDER BY e."created_at") FILTER (WHERE e."user_id" IS NOT NULL))[1],
       min(e."created_at"),
       max(e."created_at")
FROM "analytics_events" e
WHERE e."anonymous_id" NOT LIKE 'u:%'
GROUP BY e."anonymous_id"
ON CONFLICT ("anonymous_id") DO NOTHING;

-- Cancelled subscriptions: when they stopped (best known: the last update).
UPDATE "subscriptions" SET "canceled_at" = "updated_at" WHERE "status" = 'CANCELED' AND "canceled_at" IS NULL;

-- MRR history for subscriptions recorded before amounts were stored: the default monthly list
-- price of the plan in its currency (see DEFAULT_PRICES in @cvb/domain), a "new" movement when it
-- was created and a "churn" movement when it was cancelled. Trials and incomplete ones never paid.
WITH legacy AS (
  SELECT s."id", s."provider_ref", s."user_id", s."status", s."currency", s."created_at", s."canceled_at",
         lower(s."plan"::text) AS "plan",
         CASE s."currency"
           WHEN 'pkr' THEN CASE s."plan" WHEN 'STANDARD' THEN 99000 WHEN 'PREMIUM' THEN 199000 WHEN 'EXECUTIVE' THEN 499000 ELSE 0 END
           ELSE CASE s."plan" WHEN 'STANDARD' THEN 700 WHEN 'PREMIUM' THEN 1500 WHEN 'EXECUTIVE' THEN 3900 ELSE 0 END
         END AS "mrr"
  FROM "subscriptions" s
  WHERE s."status" IN ('ACTIVE', 'PAST_DUE', 'CANCELED')
)
INSERT INTO "mrr_movements" ("id", "subscription_ref", "user_id", "kind", "currency", "plan", "before_cents", "after_cents", "delta_cents", "occurred_at")
SELECT 'backfill-new-' || l."id", l."provider_ref", l."user_id", 'new', l."currency", l."plan", 0, l."mrr", l."mrr", l."created_at"
FROM legacy l WHERE l."mrr" > 0
UNION ALL
SELECT 'backfill-churn-' || l."id", l."provider_ref", l."user_id", 'churn', l."currency", l."plan", l."mrr", 0, -l."mrr", l."canceled_at"
FROM legacy l WHERE l."mrr" > 0 AND l."status" = 'CANCELED' AND l."canceled_at" IS NOT NULL;
