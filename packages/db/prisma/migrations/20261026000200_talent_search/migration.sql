-- CreateTable
CREATE TABLE "talent_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resume_id" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "headline" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "roles" TEXT[],
    "share" TEXT NOT NULL DEFAULT 'summary',
    "titles" TEXT[],
    "skills" TEXT[],
    "search_text" TEXT NOT NULL DEFAULT '',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_contacts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "talent_profiles_user_id_key" ON "talent_profiles"("user_id");

-- CreateIndex
CREATE INDEX "talent_profiles_visible_updated_at_idx" ON "talent_profiles"("visible", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "talent_contacts_sender_id_created_at_idx" ON "talent_contacts"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "talent_contacts_org_id_profile_id_created_at_idx" ON "talent_contacts"("org_id", "profile_id", "created_at");

-- CreateIndex
CREATE INDEX "talent_contacts_org_id_created_at_idx" ON "talent_contacts"("org_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "talent_profiles" ADD CONSTRAINT "talent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_profiles" ADD CONSTRAINT "talent_profiles_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_contacts" ADD CONSTRAINT "talent_contacts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_contacts" ADD CONSTRAINT "talent_contacts_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_contacts" ADD CONSTRAINT "talent_contacts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
