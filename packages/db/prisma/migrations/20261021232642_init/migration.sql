-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STANDARD', 'PREMIUM', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "PageSize" AS ENUM ('A4', 'LETTER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'LOCAL');

-- CreateEnum
CREATE TYPE "PassKind" AS ENUM ('DAYS_7', 'DAYS_30');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "template_id" TEXT NOT NULL DEFAULT 'classic',
    "accent" TEXT,
    "page_size" "PageSize" NOT NULL DEFAULT 'A4',
    "data" JSONB NOT NULL,
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_versions" (
    "id" TEXT NOT NULL,
    "resume_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "template_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "resume_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT,
    "expires_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "provider_ref" TEXT NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "PassKind" NOT NULL,
    "plan" "Plan" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "provider_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "resumes_user_id_updated_at_idx" ON "resumes"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "resume_versions_resume_id_created_at_idx" ON "resume_versions"("resume_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "share_links_slug_key" ON "share_links"("slug");

-- CreateIndex
CREATE INDEX "share_links_resume_id_idx" ON "share_links"("resume_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_ref_key" ON "subscriptions"("provider_ref");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "passes_provider_ref_key" ON "passes"("provider_ref");

-- CreateIndex
CREATE INDEX "passes_user_id_ends_at_idx" ON "passes"("user_id", "ends_at");

-- CreateIndex
CREATE INDEX "credit_ledger_user_id_created_at_idx" ON "credit_ledger"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passes" ADD CONSTRAINT "passes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
