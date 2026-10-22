-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "remote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salary" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "share_links" ADD COLUMN     "label" TEXT,
ADD COLUMN     "last_notified_at" TIMESTAMP(3),
ADD COLUMN     "notify_on_view" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resume_id" TEXT,
    "cover_letter_id" TEXT,
    "share_link_id" TEXT,
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "currency" TEXT,
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "research" JSONB NOT NULL DEFAULT '{}',
    "offer" JSONB,
    "applied_at" TIMESTAMP(3),
    "interview_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "follow_up_days" INTEGER,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_boards" (
    "user_id" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracker_boards_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "done_at" TIMESTAMP(3),
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_preferences" (
    "user_id" TEXT NOT NULL,
    "titles" TEXT[],
    "location" TEXT NOT NULL DEFAULT '',
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "salary_min" INTEGER,
    "alerts" TEXT NOT NULL DEFAULT 'off',
    "last_alert_at" TIMESTAMP(3),
    "weekly_digest" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "seniority" TEXT NOT NULL DEFAULT '',
    "job_id" TEXT,
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "star_stories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "situation" TEXT NOT NULL DEFAULT '',
    "task" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "source_bullet" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "star_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_views" (
    "id" TEXT NOT NULL,
    "share_link_id" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "referrer" TEXT,
    "country" TEXT,
    "device" TEXT,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "downloaded" BOOLEAN NOT NULL DEFAULT false,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_user_id_status_position_idx" ON "applications"("user_id", "status", "position");

-- CreateIndex
CREATE INDEX "reminders_due_at_notified_at_idx" ON "reminders"("due_at", "notified_at");

-- CreateIndex
CREATE INDEX "reminders_user_id_due_at_idx" ON "reminders"("user_id", "due_at");

-- CreateIndex
CREATE INDEX "interview_sessions_user_id_created_at_idx" ON "interview_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "star_stories_user_id_updated_at_idx" ON "star_stories"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "link_views_share_link_id_viewed_at_idx" ON "link_views"("share_link_id", "viewed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_boards" ADD CONSTRAINT "tracker_boards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_preferences" ADD CONSTRAINT "job_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "star_stories" ADD CONSTRAINT "star_stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_views" ADD CONSTRAINT "link_views_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

