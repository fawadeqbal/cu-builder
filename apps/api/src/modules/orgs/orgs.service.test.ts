import { InMemoryJobProducer } from "@cvb/queue";
import { ForbiddenError, ValidationError } from "@cvb/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { EntitlementsService } from "../billing/entitlements.service.js";
import type { BillingRepository } from "../billing/billing.repository.js";
import { InMemoryOrgsStore } from "./in-memory-orgs.store.js";
import { OrgsService } from "./orgs.service.js";

const user = (id: string, email = `${id}@example.com`, role: AuthUser["role"] = "user"): AuthUser => ({ id, email, name: id, role, emailVerified: true, plan: "free", planSource: "base" });
const owner = user("owner");

describe("OrgsService", () => {
  let store: InMemoryOrgsStore;
  let jobs: InMemoryJobProducer;
  let orgs: OrgsService;

  beforeEach(() => {
    store = new InMemoryOrgsStore();
    jobs = new InMemoryJobProducer();
    orgs = new OrgsService(store, jobs, { APP_URL: "https://app.test" });
  });

  it("creates an organisation with its creator as owner", async () => {
    const org = await orgs.create(owner, { name: "Lahore University", kind: "university" });
    expect(org).toMatchObject({ slug: "lahore-university", role: "owner", seatsUsed: 0 });
    expect(org.inviteCode).not.toBe("");
    await expect(orgs.members(user("stranger"), org.id)).rejects.toThrow();
  });

  it("invites by email and joins with the token, within seats", async () => {
    const org = await orgs.create(owner, { name: "Uni", kind: "university" });
    await orgs.adminUpdate(org.id, { seats: 1 });
    const invite = await orgs.invite(owner, org.id, { email: "Ali@Uni.edu", role: "member", cohort: "2026" });
    expect(invite.email).toBe("ali@uni.edu");
    const sent = jobs.jobs.find((j) => j.queue === "email")!.payload as { action: { url: string } };
    const token = sent.action.url.split("/join/")[1]!;
    await expect(orgs.join(user("bob", "bob@uni.edu"), token)).rejects.toBeInstanceOf(ForbiddenError);
    const joined = await orgs.join(user("ali", "ali@uni.edu"), token);
    expect(joined.role).toBe("member");
    expect((await store.membership(org.id, "ali"))!.cohort).toBe("2026");
    // Seats are full now: the open link refuses students.
    await expect(orgs.join(user("sam"), org.inviteCode)).rejects.toBeInstanceOf(ValidationError);
  });

  it("bulk-invites from CSV, skipping members", async () => {
    const org = await orgs.create(owner, { name: "Uni", kind: "university" });
    const preview = await orgs.bulkInvite(owner, org.id, "email,role,cohort\nowner@example.com,student,\na@x.edu,student,A\nb@x.edu,reviewer,\nnope", true);
    expect(preview).toMatchObject({ invited: 0, skipped: [{ email: "owner@example.com" }], errors: [{ line: 5 }] });
    expect(preview.rows.map((r) => r.email)).toEqual(["a@x.edu", "b@x.edu"]);
    const done = await orgs.bulkInvite(owner, org.id, "a@x.edu\nb@x.edu,reviewer", false);
    expect(done.invited).toBe(2);
    expect(jobs.jobs.filter((j) => j.queue === "email")).toHaveLength(2);
  });

  it("keeps an owner and limits who changes roles", async () => {
    const org = await orgs.create(owner, { name: "Uni", kind: "university" });
    await orgs.adminUpdate(org.id, { seats: 5 });
    await orgs.join(user("rev"), org.inviteCode);
    const rev = (await store.membership(org.id, "rev"))!;
    await orgs.updateMember(owner, org.id, rev.id, { role: "admin" });
    const me = (await store.membership(org.id, "owner"))!;
    await expect(orgs.updateMember(user("rev"), org.id, me.id, { role: "member" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(orgs.removeMember(owner, org.id, me.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("joins people on the SSO domain and lifts their plan with a seat", async () => {
    const org = await orgs.create(owner, { name: "Uni", kind: "university" });
    await orgs.update(owner, org.id, { ssoDomains: ["@Uni.edu.pk"] });
    await orgs.adminUpdate(org.id, { seats: 10, seatPlan: "premium" });
    expect(await orgs.autoJoin({ id: "s1", email: "s1@uni.edu.pk" })).toBe(1);
    expect(await orgs.autoJoin({ id: "s1", email: "s1@uni.edu.pk" })).toBe(0);
    const billing = { profile: async () => ({ basePlan: "free", subscriptions: [], passes: [], stripeCustomerId: null }) } as unknown as BillingRepository;
    expect(await new EntitlementsService(billing, store).planFor("s1")).toEqual({ plan: "premium", source: "organization" });
    expect(await new EntitlementsService(billing, store).planFor("owner")).toEqual({ plan: "free", source: "base" });
  });

  it("builds the cohort dashboard and CSV", async () => {
    const org = await orgs.create(owner, { name: "Uni", kind: "university" });
    const now = new Date();
    store.students.set(org.id, [
      { userId: "a", name: "Ali", email: "a@x", cohort: "2026", role: "member", resumes: [], applications: [{ status: "offer", appliedAt: now, interviewAt: now, updatedAt: now }], lastActiveAt: now },
      { userId: "b", name: "Bano", email: "b@x", cohort: "2027", role: "member", resumes: [], applications: [], lastActiveAt: null },
    ]);
    const all = await orgs.cohort(owner, org.id);
    expect(all.cohorts).toEqual(["2026", "2027"]);
    expect(all.metrics).toMatchObject({ students: 2, offers: 1, placed: 1 });
    expect((await orgs.cohort(owner, org.id, "2027")).rows.map((r) => r.name)).toEqual(["Bano"]);
    expect(await orgs.cohortCsv(owner, org.id)).toMatch(/^Name,Email,Cohort/);
  });
});
