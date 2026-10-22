import { emptyCV, type CV } from "@cvb/domain";
import { InMemoryJobProducer } from "@cvb/queue";
import { ForbiddenError, NotFoundError, RateLimitedError } from "@cvb/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { InMemoryOrgsStore } from "../orgs/in-memory-orgs.store.js";
import { OrgsService } from "../orgs/orgs.service.js";
import { InMemoryTalentStore } from "./in-memory-talent.store.js";
import { TalentService } from "./talent.service.js";

const user = (id: string, role: AuthUser["role"] = "user"): AuthUser => ({
  id,
  email: `${id}@example.com`,
  name: id,
  role,
  emailVerified: true,
  plan: "free",
  planSource: "base",
});

const cv = (headline: string, skills: string, extra: Partial<CV["personal"]> = {}): CV => ({
  ...emptyCV,
  personal: { ...emptyCV.personal, name: "Ayesha Khan", headline, email: "ayesha@private.example", phone: "+92 300 1234567", ...extra },
  summary: "Five years of web work. Write to ayesha@private.example.",
  experience: [{ id: "e1", role: headline, company: "Acme", location: "Lahore", date: "2021 – Present", bullets: ["Built things"], stack: "" }],
  skills: [{ id: "s1", category: "Skills", items: skills }],
});

describe("TalentService", () => {
  let talentStore: InMemoryTalentStore;
  let orgsStore: InMemoryOrgsStore;
  let jobs: InMemoryJobProducer;
  let talent: TalentService;
  let orgs: OrgsService;
  let agencyId: string;
  const seeker = user("ayesha");
  const recruiter = user("bilal");
  const owner = user("owner");

  beforeEach(async () => {
    talentStore = new InMemoryTalentStore();
    orgsStore = new InMemoryOrgsStore();
    jobs = new InMemoryJobProducer();
    orgs = new OrgsService(orgsStore, jobs, { APP_URL: "https://app.test" });
    talent = new TalentService(talentStore, jobs, orgs);

    const agency = await orgs.create(owner, { name: "Hire & Co", kind: "agency" });
    agencyId = agency.id;
    await orgsStore.addMember({ orgId: agencyId, userId: recruiter.id, role: "recruiter", cohort: "", seat: false });
    talentStore.orgNames.set(agencyId, "Hire & Co");
    for (const u of [seeker, recruiter, owner]) talentStore.users.set(u.id, { id: u.id, name: u.name, email: u.email, blocked: false });
    talentStore.resumes.set("r1", { id: "r1", userId: seeker.id, data: cv("Frontend developer", "React, TypeScript"), templateId: "modern", accent: null, updatedAt: new Date(), deleted: false });
    jobs.jobs.length = 0;
  });

  const optIn = (over: Partial<Parameters<TalentService["saveProfile"]>[1]> = {}) =>
    talent.saveProfile(seeker, { enabled: true, resumeId: "r1", headline: "Frontend developer", location: "Lahore", roles: ["React developer"], share: "summary", ...over });

  it("is off until the person opts in", async () => {
    expect(await talent.profile(seeker)).toMatchObject({ enabled: false, resumeId: null });
    expect((await talent.search(recruiter, agencyId, { limit: 20 })).items).toEqual([]);
  });

  it("only offers the person's own, live CVs", async () => {
    talentStore.resumes.set("other", { id: "other", userId: "someone", data: emptyCV, templateId: "classic", accent: null, updatedAt: new Date(), deleted: false });
    await expect(optIn({ resumeId: "other" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("finds an opted-in profile by skills, title, place and role", async () => {
    const saved = await optIn();
    expect(saved).toMatchObject({ enabled: true, resumeId: "r1", roles: ["React developer"], share: "summary" });
    const hit = await talent.search(recruiter, agencyId, { q: "react typescript", location: "lahore", role: "react", limit: 20 });
    expect(hit.items).toHaveLength(1);
    expect(hit.items[0]).toMatchObject({ headline: "Frontend developer", location: "Lahore", skills: ["React", "TypeScript"], share: "summary" });
    expect(hit.contactsLeft).toBe(20);
    expect((await talent.search(recruiter, agencyId, { q: "python", limit: 20 })).items).toHaveLength(0);
    expect((await talent.search(recruiter, agencyId, { location: "Karachi", limit: 20 })).items).toHaveLength(0);
    // Contact details are not searchable.
    expect((await talent.search(recruiter, agencyId, { q: "ayesha@private.example", limit: 20 })).items).toHaveLength(0);
  });

  it("hides a profile that is switched off, whose CV is deleted, or whose account is suspended", async () => {
    await optIn();
    await optIn({ enabled: false });
    expect((await talent.search(recruiter, agencyId, { limit: 20 })).items).toHaveLength(0);

    await optIn();
    talentStore.resumes.get("r1")!.deleted = true;
    expect((await talent.search(recruiter, agencyId, { limit: 20 })).items).toHaveLength(0);

    talentStore.resumes.get("r1")!.deleted = false;
    talentStore.users.get(seeker.id)!.blocked = true;
    expect((await talent.search(recruiter, agencyId, { limit: 20 })).items).toHaveLength(0);
  });

  it("removes the profile and its messages when the person deletes it", async () => {
    const id = (await optIn(), talentStore.profiles[0]!.id);
    await talent.contact(recruiter, agencyId, id, { message: "Hi, we have a React role in Lahore for you." });
    await talent.deleteProfile(seeker);
    expect(talentStore.profiles).toHaveLength(0);
    expect(talentStore.contacts).toHaveLength(0);
    await expect(talent.view(recruiter, agencyId, id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("follows CV edits in search", async () => {
    await optIn();
    const before = talentStore.profiles[0]!.syncedAt;
    const r = talentStore.resumes.get("r1")!;
    r.data = cv("Frontend developer", "React, TypeScript, GraphQL");
    r.updatedAt = new Date(before.getTime() + 1000);
    const hit = await talent.search(recruiter, agencyId, { q: "graphql", limit: 20 });
    expect(hit.items).toHaveLength(1);
  });

  it("is for agencies' recruiting staff only", async () => {
    await optIn();
    const uni = await orgs.create(owner, { name: "Uni", kind: "university" });
    await expect(talent.search(owner, uni.id, { limit: 20 })).rejects.toBeInstanceOf(ForbiddenError);
    await orgsStore.addMember({ orgId: agencyId, userId: "member1", role: "member", cohort: "", seat: true });
    await expect(talent.search(user("member1"), agencyId, { limit: 20 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(talent.search(user("stranger"), agencyId, { limit: 20 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("shows a summary without contact details, or the full CV when chosen", async () => {
    await optIn();
    const id = talentStore.profiles[0]!.id;
    const summary = await talent.view(recruiter, agencyId, id);
    expect(summary.cv.personal).toMatchObject({ name: "Ayesha", email: "", phone: "" });
    expect(JSON.stringify(summary)).not.toContain("ayesha@private.example");
    expect(summary.templateId).toBe("classic");

    await optIn({ share: "full" });
    const full = await talent.view(recruiter, agencyId, id);
    expect(full.cv.personal.email).toBe("ayesha@private.example");
    expect(full.templateId).toBe("modern");
  });

  it("emails the person without revealing their address, and logs it", async () => {
    await optIn();
    const id = talentStore.profiles[0]!.id;
    const res = await talent.contact(recruiter, agencyId, id, { message: "Hi Ayesha, we have a React role in Lahore." });
    expect(res.contactsLeft).toBe(19);
    expect(jobs.jobs).toHaveLength(1);
    expect(jobs.jobs[0]!.payload).toMatchObject({
      template: "talent-contact",
      to: "ayesha@example.com",
      recruiterName: "bilal",
      orgName: "Hire & Co",
      replyTo: "bilal@example.com",
    });
    const log = await talent.contactLog(owner, agencyId);
    expect(log).toMatchObject([{ profileId: id, senderName: "bilal", headline: "Frontend developer" }]);
    expect(JSON.stringify(log)).not.toContain("ayesha@example.com");
    expect((await talent.profile(seeker)).contacts).toMatchObject([{ orgName: "Hire & Co", senderName: "bilal" }]);
    expect((await talent.view(recruiter, agencyId, id)).lastContactedAt).not.toBeNull();
  });

  it("limits repeat messages and messages per member per day", async () => {
    await optIn();
    const id = talentStore.profiles[0]!.id;
    await talent.contact(recruiter, agencyId, id, { message: "Hi Ayesha, we have a React role in Lahore." });
    await expect(talent.contact(owner, agencyId, id, { message: "Following up on my colleague's message." })).rejects.toBeInstanceOf(RateLimitedError);

    const now = Date.now();
    for (let i = 0; i < 19; i++) talentStore.contacts.push({ id: `x${i}`, orgId: agencyId, senderId: recruiter.id, profileId: `p${i}`, message: "", createdAt: new Date(now - i * 1000) });
    talentStore.contacts = talentStore.contacts.filter((c) => c.profileId !== id);
    talentStore.contacts.push({ id: "y", orgId: agencyId, senderId: recruiter.id, profileId: "another", message: "", createdAt: new Date(now) });
    expect((await talent.search(recruiter, agencyId, { limit: 20 })).contactsLeft).toBe(0);
    await expect(talent.contact(recruiter, agencyId, id, { message: "Hi Ayesha, we have a React role in Lahore." })).rejects.toThrow(/24 hours/);
  });

  it("lets site admins look but not write", async () => {
    await optIn();
    const id = talentStore.profiles[0]!.id;
    const admin = user("admin", "admin");
    expect((await talent.search(admin, agencyId, { limit: 20 })).items).toHaveLength(1);
    await expect(talent.contact(admin, agencyId, id, { message: "Hello from the site admin team." })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
