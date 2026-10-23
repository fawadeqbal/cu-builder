import { DEFAULT_PRICES, channelOf, monthlyCents, offerById, sampleCV, type Currency, type OfferId, type Touch } from "@cvb/domain";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config } from "dotenv";
import { createDbClient, type DbClient } from "../src/client.js";
import type { Prisma } from "../src/generated/prisma/client.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

/**
 * SAMPLE ANALYTICS DATA, FOR LOCAL DEVELOPMENT ONLY.
 *
 * Generates about 180 days of synthetic, clearly fake activity (so every report, including the
 * 90-day comparison, has something to show): visitors and sessions from a mix of sources,
 * devices and countries; page views and product events; sign-ups with first-touch
 * attribution; CVs; subscriptions, passes and credit packs in USD and PKR with renewals,
 * upgrades, cancellations, failed payments and refunds; a few expert orders.
 *
 * Everything it writes is marked so it can be removed, and is removed before each run:
 * - users: email `sample-NNNN@sample.cvbuilder.invalid`, name "Sample person NNNN"
 * - browsers: anonymous ids starting `sample-`; events carry the prop `sample: true`
 * - billing: provider refs and event ids starting `sample_`
 *
 *   pnpm db:seed:analytics           # replace the sample data
 *   pnpm db:seed:analytics --clear   # only remove it
 *   pnpm db:seed:analytics --dry-run # generate and count, write nothing (no database needed)
 *
 * Refuses to run when NODE_ENV is "production".
 */

const DAYS = 180;
const DAY = 86_400_000;
const EMAIL_DOMAIN = "sample.cvbuilder.invalid";
const ANON = "sample-";
const REF = "sample_";

// ─── Deterministic randomness, so two runs look the same ─────────────────────

let state = 20261027;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const chance = (p: number) => rand() < p;
const int = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
function pick<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items.at(-1)![0];
}
const id = (prefix: string) => `${prefix}${Math.floor(rand() * 1e12).toString(36)}${Math.floor(rand() * 1e12).toString(36)}`;

// ─── The mix of people ───────────────────────────────────────────────────────

const CHANNELS: (readonly [Touch, number])[] = [
  [{}, 28],
  [{ referrer: "google.com" }, 24],
  [{ referrer: "google.com.pk" }, 6],
  [{ referrer: "linkedin.com" }, 10],
  [{ source: "facebook", medium: "cpc", campaign: "launch-pk", referrer: "facebook.com" }, 8],
  [{ referrer: "rozee.pk" }, 5],
  [{ source: "newsletter", medium: "email", campaign: "october-tips" }, 4],
  [{ referrer: "wa.me" }, 5],
  [{ referrer: "chatgpt.com" }, 4],
  [{ referrer: "bing.com" }, 3],
  [{ source: "linkedin", medium: "social", campaign: "cv-examples" }, 3],
];
const EXAMPLES = ["software-engineer", "nurse", "accountant", "teacher", "data-analyst", "fresh-graduate", "civil-engineer", "sales-executive"];
const LANDINGS: (readonly [string, number])[] = [
  ["/", 38],
  ["/cv-examples/:example", 20],
  ["/ats-checker", 12],
  ["/tools/summary-generator", 5],
  ["/tools/bullet-improver", 4],
  ["/templates", 9],
  ["/pricing", 7],
  ["/cv-examples", 5],
];
const COUNTRIES: (readonly [string, number])[] = [
  ["PK", 55],
  ["AE", 8],
  ["SA", 6],
  ["GB", 6],
  ["US", 8],
  ["IN", 5],
  ["CA", 3],
  ["QA", 2],
  ["DE", 2],
];
const DEVICES: (readonly [string, number])[] = [
  ["mobile", 58],
  ["desktop", 36],
  ["tablet", 6],
];
const BROWSERS: (readonly [string, number])[] = [
  ["Chrome", 64],
  ["Safari", 20],
  ["Edge", 6],
  ["Samsung Internet", 6],
  ["Firefox", 4],
];
const SUB_OFFERS: (readonly [OfferId, number])[] = [
  ["premium_monthly", 40],
  ["standard_monthly", 22],
  ["premium_yearly", 16],
  ["executive_monthly", 8],
  ["standard_yearly", 8],
  ["executive_yearly", 3],
];
const AI_TASKS = ["improve-bullet", "write-summary", "rewrite", "suggest-skills", "tailor", "cover-letter", "linkedin-profile"];

type Visitor = {
  anonymousId: string;
  touch: Touch;
  source: string;
  medium: string;
  landing: string;
  device: string;
  browser: string;
  country: string;
  locale: string;
  currency: Currency;
  firstSeenAt: Date;
  lastSeenAt: Date;
  userId: string | null;
};

type EventRow = Prisma.AnalyticsEventCreateManyInput;

// ─── Generation ──────────────────────────────────────────────────────────────

async function clear(db: DbClient) {
  const users = await db.user.findMany({ where: { email: { endsWith: `@${EMAIL_DOMAIN}` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const events = await db.analyticsEvent.deleteMany({
    where: { OR: [{ anonymousId: { startsWith: ANON } }, { anonymousId: { in: ids.map((i) => `u:${i}`) } }, { userId: { in: ids } }] },
  });
  await db.analyticsVisitor.deleteMany({ where: { anonymousId: { startsWith: ANON } } });
  await db.mrrMovement.deleteMany({ where: { subscriptionRef: { startsWith: REF } } });
  await db.billingEvent.deleteMany({ where: { id: { startsWith: REF } } });
  // Users cascade to their CVs, subscriptions, passes, credits and orders.
  const removed = await db.user.deleteMany({ where: { id: { in: ids } } });
  return { events: events.count, users: removed.count };
}

/** Builds the sample rows (pure apart from the clock; the same every run for a given day). */
export function generateSampleData(now: Date = new Date()) {
  state = 20261027;
  const end = now.getTime();
  const start = end - DAYS * DAY;
  const visitors: Visitor[] = [];
  const events: EventRow[] = [];
  const users: Prisma.UserCreateManyInput[] = [];
  const resumes: Prisma.ResumeCreateManyInput[] = [];
  const subscriptions: Prisma.SubscriptionCreateManyInput[] = [];
  const movements: Prisma.MrrMovementCreateManyInput[] = [];
  const billing: Prisma.BillingEventCreateManyInput[] = [];
  const passes: Prisma.PassCreateManyInput[] = [];
  const credits: Prisma.CreditLedgerCreateManyInput[] = [];
  const orders: Prisma.ServiceOrderCreateManyInput[] = [];
  let userNo = 0;

  const ev = (v: Visitor, name: string, at: number, session: string, path: string | null, props: Record<string, string | number | boolean> = {}, userId: string | null = null) => {
    if (at > end) return;
    events.push({
      name,
      anonymousId: v.anonymousId,
      userId,
      sessionId: session,
      path,
      // Only the first session came from the campaign or site; later ones are direct.
      referrerDomain: session.endsWith("-s1") ? (v.touch.referrer ?? null) : null,
      utmSource: session.endsWith("-s1") ? (v.touch.source ?? null) : null,
      utmMedium: session.endsWith("-s1") ? (v.touch.medium ?? null) : null,
      utmCampaign: session.endsWith("-s1") ? (v.touch.campaign ?? null) : null,
      device: v.device,
      browser: v.browser,
      country: v.country,
      locale: v.locale,
      currency: v.currency,
      props: { ...props, sample: true },
      createdAt: new Date(at),
    });
    if (at > v.lastSeenAt.getTime()) v.lastSeenAt = new Date(at);
  };
  const serverEv = (userId: string, name: string, at: number, props: Record<string, string | number | boolean>, currency: string | null = null) => {
    if (at > end) return;
    events.push({ name, anonymousId: `u:${userId}`, userId, currency, props: { ...props, sample: true }, createdAt: new Date(at) });
  };

  const priceOf = (offer: OfferId, c: Currency) => DEFAULT_PRICES[c][offer];

  /** A paying customer: a subscription with renewals and maybe a change or a cancellation, or a pass, or credits. */
  function purchase(v: Visitor, userId: string, at: number) {
    const c = v.currency;
    const kind = pick([
      ["subscription", 62],
      ["pass", 26],
      ["credits", 12],
    ] as const);
    if (kind === "pass") {
      const offer: OfferId = chance(0.6) ? "pass_30d" : "pass_7d";
      const o = offerById(offer);
      const amount = priceOf(offer, c);
      const ref = id(`${REF}cs_`);
      passes.push({
        userId,
        kind: offer === "pass_7d" ? "DAYS_7" : "DAYS_30",
        plan: "PREMIUM",
        startsAt: new Date(at),
        endsAt: new Date(at + (o.kind === "pass" ? o.days : 7) * DAY),
        provider: "STRIPE",
        providerRef: ref,
        amountCents: amount,
        currency: c,
        createdAt: new Date(at),
      });
      billing.push({ id: id(`${REF}evt_`), provider: "STRIPE", type: "payment.completed", amountCents: amount, currency: c, userId, offer, processedAt: new Date(at) });
      serverEv(userId, "purchase_completed", at, { offer, kind: "pass", amount }, c);
      if (chance(0.03)) billing.push({ id: id(`${REF}ch_`), provider: "STRIPE", type: "charge.refunded", amountCents: amount, currency: c, userId, processedAt: new Date(at + int(1, 5) * DAY) });
      return;
    }
    if (kind === "credits") {
      const amount = priceOf("credits_100", c);
      billing.push({ id: id(`${REF}evt_`), provider: "STRIPE", type: "payment.completed", amountCents: amount, currency: c, userId, offer: "credits_100", processedAt: new Date(at) });
      credits.push({ userId, delta: 100, reason: `sample:purchase`, createdAt: new Date(at) });
      serverEv(userId, "purchase_completed", at, { offer: "credits_100", kind: "credits", amount }, c);
      return;
    }
    let offer = pick(SUB_OFFERS);
    let o = offerById(offer);
    if (o.kind !== "subscription") return;
    const ref = id(`${REF}sub_`);
    let amount = priceOf(offer, c);
    let mrr = monthlyCents(amount, o.interval);
    movements.push({ subscriptionRef: ref, userId, kind: "new", currency: c, plan: o.plan, beforeCents: 0, afterCents: mrr, deltaCents: mrr, occurredAt: new Date(at) });
    serverEv(userId, "subscription_started", at, { plan: o.plan, interval: o.interval }, c);
    const periodDays = o.interval === "year" ? 365 : 30;
    let t = at;
    let status: "ACTIVE" | "CANCELED" | "PAST_DUE" = "ACTIVE";
    let canceledAt: Date | null = null;
    let reason = "start";
    while (t <= end) {
      billing.push({ id: id(`${REF}in_`), provider: "STRIPE", type: "invoice.paid", amountCents: amount, currency: c, userId, offer, processedAt: new Date(t) });
      if (reason === "renewal") serverEv(userId, "subscription_renewed", t, { amount, offer }, c);
      const next = t + periodDays * DAY;
      if (next > end) break;
      // Some cancel, a few upgrade, some have a card declined first.
      if (chance(o.interval === "year" ? 0.05 : 0.14)) {
        status = "CANCELED";
        canceledAt = new Date(next);
        movements.push({ subscriptionRef: ref, userId, kind: "churn", currency: c, plan: o.plan, beforeCents: mrr, afterCents: 0, deltaCents: -mrr, occurredAt: canceledAt });
        serverEv(userId, "subscription_cancelled", next, { plan: o.plan }, c);
        break;
      }
      if (o.plan !== "executive" && o.interval === "month" && chance(0.06)) {
        const up: OfferId = o.plan === "standard" ? "premium_monthly" : "executive_monthly";
        const upOffer = offerById(up);
        if (upOffer.kind === "subscription") {
          const newAmount = priceOf(up, c);
          const newMrr = monthlyCents(newAmount, "month");
          movements.push({ subscriptionRef: ref, userId, kind: "expansion", currency: c, plan: upOffer.plan, beforeCents: mrr, afterCents: newMrr, deltaCents: newMrr - mrr, occurredAt: new Date(next) });
          offer = up;
          o = upOffer;
          amount = newAmount;
          mrr = newMrr;
        }
      }
      if (chance(0.04)) billing.push({ id: id(`${REF}in_`), provider: "STRIPE", type: "invoice.payment_failed", amountCents: amount, currency: c, userId, processedAt: new Date(next - 2 * DAY) });
      t = next;
      reason = "renewal";
    }
    if (status === "ACTIVE" && chance(0.03)) status = "PAST_DUE";
    subscriptions.push({
      userId,
      plan: o.plan.toUpperCase() as "STANDARD" | "PREMIUM" | "EXECUTIVE",
      status,
      provider: "STRIPE",
      providerRef: ref,
      currentPeriodEnd: new Date(Math.max(t + periodDays * DAY, end + DAY)),
      cancelAtPeriodEnd: false,
      currency: c,
      offerId: offer,
      amountCents: amount,
      interval: o.interval,
      canceledAt,
      createdAt: new Date(at),
    });
  }

  for (let day = 0; day < DAYS; day++) {
    const dayStart = start + day * DAY;
    const weekday = new Date(dayStart).getUTCDay();
    // Growth over the period, quieter weekends, some noise.
    const base = 14 + (day / DAYS) * 46;
    const count = Math.round(base * (weekday === 0 || weekday === 6 ? 0.7 : 1) * (0.8 + rand() * 0.4));
    for (let k = 0; k < count; k++) {
      const touch = pick(CHANNELS);
      const { source, medium } = channelOf(touch);
      const country = pick(COUNTRIES);
      const example = EXAMPLES[int(0, EXAMPLES.length - 1)]!;
      const landing = pick(LANDINGS).replace(":example", example);
      const firstAt = dayStart + int(6, 23) * 3_600_000 + int(0, 3_599_999);
      const v: Visitor = {
        anonymousId: id(ANON),
        touch: { ...touch, landing },
        source,
        medium,
        landing,
        device: pick(DEVICES),
        browser: pick(BROWSERS),
        country,
        locale: country === "PK" ? pick([["en", 78], ["ur", 22]] as const) : ["AE", "SA", "QA"].includes(country) ? pick([["en", 75], ["ar", 25]] as const) : "en",
        currency: country === "PK" ? "pkr" : "usd",
        firstSeenAt: new Date(firstAt),
        lastSeenAt: new Date(firstAt),
        userId: null,
      };
      visitors.push(v);

      // Sessions: the first, then maybe a few more over the following weeks.
      const sessions = [firstAt];
      for (let s = 0; s < 4 && chance(0.32); s++) sessions.push(sessions.at(-1)! + int(1, 12) * DAY + int(0, 20) * 3_600_000);
      let userId: string | null = null;
      let signedUpAt = 0;
      let hasCv = false;

      sessions.forEach((sAt, si) => {
        const session = `${v.anonymousId}-s${si + 1}`;
        let t = sAt;
        const step = () => (t += int(20, 240) * 1000);
        const path = si === 0 ? landing : pick([["/", 3], ["/app", 5], ["/pricing", 1], ["/templates", 1]] as const);
        ev(v, "page_view", t, session, path, {}, userId);
        if (path.startsWith("/cv-examples/")) ev(v, "cv_example_viewed", step(), session, path, { example }, userId);
        if (path === "/ats-checker" && chance(0.75)) {
          ev(v, "free_tool_used", step(), session, path, { tool: "ats_checker" }, userId);
          ev(v, "ats_check_run", t, session, path, { where: "free_tool", input: chance(0.8) ? "file" : "text", withJob: chance(0.3) }, userId);
        }
        if (path.startsWith("/tools/") && chance(0.7)) {
          const tool = path.endsWith("summary-generator") ? "summary_generator" : "bullet_improver";
          ev(v, "free_tool_used", step(), session, path, { tool, signedIn: Boolean(userId) }, userId);
          ev(v, "ai_action_used", t, session, path, { task: tool === "summary_generator" ? "write-summary" : "improve-bullet", where: "free_tool" }, userId);
        }
        if (si === 0 && path === "/" && chance(0.45)) ev(v, "landing_cta_clicked", step(), session, "/", { cta: pick([["/builder", 5], ["/ats-checker", 2], ["/pricing", 1], ["/templates", 2]] as const), section: pick([["hero", 6], ["cta", 2], ["templates", 1], ["pricing", 1]] as const) });
        if (chance(0.12)) ev(v, "pricing_viewed", step(), session, "/pricing", {}, userId);
        if (chance(0.02)) ev(v, "currency_switched", step(), session, "/pricing", { from: v.currency, to: v.currency === "pkr" ? "usd" : "pkr" }, userId);

        // Starting and finishing a CV.
        const startP = si === 0 ? (path.startsWith("/cv-examples/") ? 0.42 : path.startsWith("/tools") || path === "/ats-checker" ? 0.3 : 0.27) : 0.12;
        if (!hasCv && chance(startP)) {
          hasCv = true;
          const src = path.startsWith("/cv-examples/")
            ? "cv_example"
            : path === "/ats-checker"
              ? "ats_check"
              : pick([["blank", 50], ["example", 14], ["import", 16], ["ai", 10], ["linkedin", 6]] as const);
          ev(v, "page_view", step(), session, "/builder", {}, userId);
          ev(v, "cv_started", t, session, "/builder", { source: src, ...(src === "cv_example" ? { example } : {}) }, userId);
          if (src === "cv_example") ev(v, "cv_example_used", t, session, path, { example }, userId);
          if (src === "import" || src === "linkedin") ev(v, src === "linkedin" ? "linkedin_import_started" : "import_started", t, session, "/app", { format: src === "linkedin" ? "linkedin" : pick([["pdf", 7], ["docx", 3]] as const) }, userId);
          const steps = ["personal", "summary", "experience", "education", "skills", "finish"];
          const reached = int(1, steps.length);
          steps.slice(0, reached).forEach((s, i) => ev(v, "builder_step_reached", step(), session, "/builder", { step: s, index: i }, userId));
          if (chance(0.5)) ev(v, "template_selected", step(), session, "/builder", { template: pick([["classic", 5], ["modern", 3], ["compact", 2]] as const) }, userId);
          if (reached === steps.length) ev(v, "cv_completed", step(), session, "/builder", {}, userId);
          if (chance(0.55)) ev(v, "ats_check_run", step(), session, "/builder", { where: "app", score: int(45, 95) }, userId);

          // Signing up (often to download).
          if (!userId && chance(0.34)) {
            userNo++;
            userId = `sample-user-${String(userNo).padStart(5, "0")}`;
            signedUpAt = step();
            v.userId = userId;
            users.push({
              id: userId,
              name: `Sample person ${String(userNo).padStart(4, "0")}`,
              email: `sample-${String(userNo).padStart(4, "0")}@${EMAIL_DOMAIN}`,
              emailVerified: true,
              locale: v.locale,
              acquisition: {
                source,
                medium,
                campaign: touch.campaign ?? null,
                term: null,
                content: null,
                referrer: touch.referrer ?? null,
                landing,
                device: v.device,
                country: v.country,
                locale: v.locale,
                firstSeenAt: v.firstSeenAt.toISOString(),
              },
              createdAt: new Date(signedUpAt),
            });
            serverEv(userId, "signed_up", signedUpAt, {});
            ev(v, "page_view", signedUpAt + 2000, session, "/app", {}, userId);
            resumes.push({ userId, title: "Sample CV (generated)", templateId: "classic", data: sampleCV as unknown as Prisma.InputJsonValue, createdAt: new Date(signedUpAt + 3000) });
          }
          if (chance(userId ? 0.7 : 0.25)) ev(v, "pdf_downloaded", step(), session, "/builder", { template: "classic", pageSize: "A4" }, userId);
          if (userId && chance(0.12)) ev(v, "docx_downloaded", step(), session, "/builder", {}, userId);
        }

        // Signed-in product use on later visits.
        if (userId && sAt > signedUpAt) {
          const n = int(1, 6);
          for (let i = 0; i < n; i++) {
            const name = pick([
              ["ai_action_used", 30],
              ["pdf_downloaded", 12],
              ["application_added", 10],
              ["cv_tailored", 8],
              ["cover_letter_created", 6],
              ["interview_session_started", 5],
              ["share_link_created", 4],
              ["template_selected", 6],
            ] as const);
            const at = step();
            ev(v, name, at, session, pick([["/app", 3], ["/jobs", 2], ["/tracker", 2], ["/edit/:id", 3]] as const), name === "ai_action_used" ? { task: AI_TASKS[int(0, AI_TASKS.length - 1)]! } : name === "application_added" ? { from: chance(0.2) ? "extension" : "tracker" } : {}, userId);
            if (name === "ai_action_used") credits.push({ userId, delta: -int(1, 3), reason: "sample:spend", createdAt: new Date(at) });
          }
          if (chance(0.06)) ev(v, "talent_opt_in", step(), session, "/account", { share: "summary" }, userId);
          if (chance(0.05)) ev(v, "review_prompt_shown", step(), session, "/builder", { after: "download" }, userId);
        }

        // Paying.
        if (userId && chance(si === 0 ? 0.16 : 0.22)) {
          ev(v, "pricing_viewed", step(), session, "/pricing", {}, userId);
          ev(v, "checkout_started", step(), session, "/pricing", { currency: v.currency }, userId);
          if (chance(0.55)) {
            purchase(v, userId, step() + 60_000);
            ev(v, "purchased", t + 90_000, session, "/account/billing", {}, userId);
          }
        }
      });

      if (userId && chance(0.03)) {
        const at = signedUpAt + int(2, 30) * DAY;
        if (at < end) {
          const price = v.currency === "pkr" ? 990_000 : 3_900;
          orders.push({ userId, kind: "review", status: "completed", priceCents: price, currency: v.currency, commissionCents: Math.round(price * 0.2), paidAt: new Date(at), createdAt: new Date(at), checkoutId: id(`${REF}order_`) });
        }
      }
    }
  }

  return { visitors, events, users, resumes, subscriptions, movements, billing, passes, credits, orders };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed sample analytics data: NODE_ENV is production. This script is for local development only.");
  }
  const dryRun = process.argv.includes("--dry-run");
  const log = (s: string) => console.log(s); // eslint-disable-line no-console -- CLI output
  const url = process.env.DATABASE_URL;
  if (!url && !dryRun) throw new Error("DATABASE_URL is not set");
  const db = dryRun ? null : createDbClient({ url: url! });

  if (db) {
    const removed = await clear(db);
    log(`Removed earlier sample data: ${removed.users} users, ${removed.events} events.`);
    if (process.argv.includes("--clear")) {
      await db.$disconnect();
      return;
    }
  }

  const { visitors, events, users, resumes, subscriptions, movements, billing, passes, credits, orders } = generateSampleData();
  log(
    `${dryRun ? "Would write" : "Writing"} ${visitors.length} visitors, ${users.length} users, ${events.length} events, ${subscriptions.length} subscriptions, ${movements.length} MRR movements, ${billing.length} billing events, ${passes.length} passes, ${orders.length} expert orders…`,
  );
  if (!db) return;
  const chunks = async <T>(rows: T[], size: number, write: (part: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size));
  };
  await chunks(users, 1000, (data) => db.user.createMany({ data }));
  await chunks(
    visitors.map(({ touch, landing, currency: _currency, ...v }) => ({ ...v, campaign: touch.campaign ?? null, referrerDomain: touch.referrer ?? null, landingPath: landing })),
    2000,
    (data) => db.analyticsVisitor.createMany({ data }),
  );
  await chunks(events, 5000, (data) => db.analyticsEvent.createMany({ data }));
  await chunks(resumes, 500, (data) => db.resume.createMany({ data }));
  await chunks(subscriptions, 1000, (data) => db.subscription.createMany({ data }));
  await chunks(movements, 2000, (data) => db.mrrMovement.createMany({ data }));
  await chunks(billing, 2000, (data) => db.billingEvent.createMany({ data }));
  await chunks(passes, 1000, (data) => db.pass.createMany({ data }));
  await chunks(credits, 2000, (data) => db.creditLedger.createMany({ data }));
  await chunks(orders, 500, (data) => db.serviceOrder.createMany({ data }));
  log(`Done. Sample people use the email domain @${EMAIL_DOMAIN}; remove everything with: pnpm db:seed:analytics --clear`);
  await db.$disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
