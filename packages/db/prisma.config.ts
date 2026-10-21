import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// One .env at the repo root serves every app and package.
config({ path: new URL("../../.env", import.meta.url).pathname, quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Optional here so `prisma generate` works without a database (CI, fresh clones).
    // Commands that connect (migrate, studio) fail clearly when it is missing.
    url: process.env["DATABASE_URL"],
  },
});
