import { sampleCV } from "@cvb/domain";
import { config } from "dotenv";
import { createDbClient } from "../src/client.js";

config({ path: new URL("../../../.env", import.meta.url).pathname, quiet: true });

/** Development data: one user with the example CV. Safe to run repeatedly. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDbClient({ url });

  const user = await db.user.upsert({
    where: { email: "dev@cvbuilder.local" },
    update: {},
    create: { email: "dev@cvbuilder.local", name: "Dev User", plan: "PREMIUM" },
  });

  const existing = await db.resume.count({ where: { userId: user.id } });
  if (existing === 0) {
    await db.resume.create({
      data: { userId: user.id, title: "Sara Ahmed — Full Stack", templateId: "classic", data: sampleCV },
    });
  }

  // eslint-disable-next-line no-console -- CLI output
  console.log(`Seeded ${user.email} (${user.id})`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
