-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'usd';

-- AlterTable
ALTER TABLE "billing_events" ADD COLUMN     "amount_cents" INTEGER,
ADD COLUMN     "currency" TEXT;

-- AlterTable
ALTER TABLE "passes" ADD COLUMN     "amount_cents" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'usd';

-- CreateTable
CREATE TABLE "price_settings" (
    "offer_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "price_settings_pkey" PRIMARY KEY ("offer_id","currency")
);
