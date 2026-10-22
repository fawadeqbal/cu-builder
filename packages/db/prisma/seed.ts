import { sampleCV } from "@cvb/domain";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { createDbClient } from "../src/client.js";

config({ path: new URL("../../../.env", import.meta.url).pathname, quiet: true });

/**
 * Development data. Safe to run repeatedly.
 * - dev@cvbuilder.local / password123: Premium user with the example CV
 * - admin@cvbuilder.local / password123: admin
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDbClient({ url });
  const password = await hashPassword("password123");

  const people = [
    { email: "dev@cvbuilder.local", name: "Dev User", plan: "PREMIUM" as const, role: "user" },
    { email: "admin@cvbuilder.local", name: "Admin", plan: "EXECUTIVE" as const, role: "admin" },
  ];

  for (const p of people) {
    const user = await db.user.upsert({
      where: { email: p.email },
      update: { role: p.role, plan: p.plan },
      create: { email: p.email, name: p.name, plan: p.plan, role: p.role, emailVerified: true },
    });
    await db.account.upsert({
      where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
      update: { password },
      create: { userId: user.id, providerId: "credential", accountId: user.id, password },
    });
    if ((await db.resume.count({ where: { userId: user.id } })) === 0) {
      await db.resume.create({ data: { userId: user.id, title: "Sara Ahmed — Full Stack", templateId: "classic", data: sampleCV } });
    }
    // eslint-disable-next-line no-console -- CLI output
    console.log(`Seeded ${user.email} / password123`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
