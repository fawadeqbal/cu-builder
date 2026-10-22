import type { DbClient } from "@cvb/db";
import type { JobProducer } from "@cvb/queue";
import { ConflictError, NotFoundError, PlanRequiredError, ValidationError } from "@cvb/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import type { AppConfig } from "../../config/app-config.js";
import type { DnsResolver } from "../domains/dns-resolver.js";
import { DomainsService } from "../domains/domains.service.js";
import { PortfolioService } from "./portfolio.service.js";

type Row = Record<string, unknown>;

/** Matches the handful of Prisma `where` shapes these services use. */
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "NOT") return !matches(row, v as Row);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const cond = v as Row;
      if ("not" in cond) return row[k] !== cond.not;
      if ("in" in cond) return (cond.in as unknown[]).includes(row[k]);
      return true;
    }
    return row[k] === v;
  });
}

function table(rows: Row[], joins: (r: Row) => Row = () => ({})) {
  let n = rows.length;
  const pick = (where: Row) => rows.find((r) => matches(r, where)) ?? null;
  return {
    rows,
    findFirst: async ({ where }: { where: Row }) => {
      const r = pick(where);
      return r && { ...r, ...joins(r) };
    },
    findUnique: async ({ where }: { where: Row }) => pick(where),
    findMany: async ({ where }: { where: Row }) => rows.filter((r) => matches(r, where)),
    count: async ({ where }: { where: Row }) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }: { data: Row }) => {
      const r = { id: `id${++n}`, createdAt: new Date(), updatedAt: new Date(), readAt: null, ...data };
      rows.push(r);
      return r;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const r = pick(where)!;
      for (const [k, v] of Object.entries(data)) r[k] = v && typeof v === "object" && "increment" in (v as Row) ? (r[k] as number) + ((v as Row).increment as number) : v;
      return r;
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i]!, where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
    upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
      const r = pick(where);
      if (r) return Object.assign(r, update);
      const row = { id: `id${++n}`, createdAt: new Date(), updatedAt: new Date(), viewCount: 0, customDomain: null, domainVerifiedAt: null, ...create };
      rows.push(row);
      return row;
    },
  };
}

const user = (id: string, plan: AuthUser["plan"]): AuthUser => ({ id, email: `${id}@example.com`, name: id, role: "user", emailVerified: true, plan, planSource: "base" });
const config = { APP_URL: "https://cvbuilder.pk", PORTFOLIO_DOMAIN: "cvbuilder.app", CUSTOM_DOMAIN_TARGET: undefined, CUSTOM_DOMAIN_IPV4: ["203.0.113.7"] } as unknown as AppConfig;

describe("PortfolioService", () => {
  let dns: Record<string, { cnames: string[]; ipv4: string[] }>;
  let sent: unknown[];
  let service: PortfolioService;
  let domains: DomainsService;
  let db: ReturnType<typeof makeDb>;

  function makeDb() {
    const users = [{ id: "u1", name: "Sara Ahmed", email: "sara@example.com" }, { id: "u2", name: "Ali", email: "ali@example.com" }];
    const resumes = table([
      { id: "r1", userId: "u1", deletedAt: null, templateId: "modern", accent: null, pageSize: "A4", data: { personal: { name: "Sara Ahmed" } } },
      { id: "r2", userId: "u2", deletedAt: null, templateId: "classic", accent: null, pageSize: "A4", data: {} },
    ]);
    const sites = table([], (s) => ({ resume: resumes.rows.find((r) => r.id === s.resumeId), user: users.find((u) => u.id === s.userId) }));
    return {
      resume: { ...resumes, findFirst: async ({ where }: { where: Row }) => resumes.rows.find((r) => matches(r, where)) ?? null },
      portfolioSite: sites,
      contactMessage: table([]),
      organization: table([{ id: "o1", name: "Uni", deletedAt: null, customDomain: "careers.uni.edu.pk", domainVerifiedAt: new Date(), branding: { primaryColor: "#0a6", extra: 1 } }]),
      membership: table([{ orgId: "o1", userId: "u2", role: "admin" }, { orgId: "o1", userId: "u1", role: "member" }]),
    };
  }

  beforeEach(() => {
    dns = {};
    sent = [];
    db = makeDb();
    const resolver: DnsResolver = { cnames: async (h) => dns[h]?.cnames ?? [], ipv4: async (h) => dns[h]?.ipv4 ?? [] };
    domains = new DomainsService(db as unknown as DbClient, config, resolver);
    const jobs = { enqueue: async (_q: unknown, _n: unknown, payload: unknown) => (sent.push(payload), "1") } as unknown as JobProducer;
    service = new PortfolioService(db as unknown as DbClient, config, jobs, domains);
  });

  const base = { resumeId: "r1", slug: "sara-ahmed", theme: "minimal" as const, accent: null, showContactForm: true, published: true, content: { about: "Hi", projects: [] } };

  it("suggests a slug, then creates and updates the site", async () => {
    expect((await service.mine(user("u1", "free"))).suggestedSlug).toBe("sara-ahmed");
    const site = await service.save(user("u1", "free"), base);
    expect(site.url).toBe("https://sara-ahmed.cvbuilder.app");
    const again = await service.save(user("u1", "free"), { ...base, theme: "bold" });
    expect(again.id).toBe(site.id);
    expect(again.theme).toBe("bold");
  });

  it("refuses reserved, taken or foreign CVs", async () => {
    await expect(service.save(user("u1", "free"), { ...base, slug: "admin" })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.save(user("u1", "free"), { ...base, resumeId: "r2" })).rejects.toBeInstanceOf(NotFoundError);
    await service.save(user("u1", "free"), base);
    await expect(service.save(user("u2", "free"), { ...base, resumeId: "r2" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("serves only published sites and counts views", async () => {
    await service.save(user("u1", "free"), { ...base, published: false });
    await expect(service.publicBySlug("sara-ahmed")).rejects.toBeInstanceOf(NotFoundError);
    await service.save(user("u1", "free"), base);
    const pub = await service.publicBySlug("sara-ahmed");
    expect(pub.ownerName).toBe("Sara Ahmed");
    expect(pub.data.personal.name).toBe("Sara Ahmed");
    await service.publicBySlug("sara-ahmed", false);
    expect(db.portfolioSite.rows[0]!.viewCount).toBe(1);
    expect((await service.publicByHost("sara-ahmed.cvbuilder.app", false)).slug).toBe("sara-ahmed");
  });

  it("stores contact messages and emails the owner, but ignores the honeypot", async () => {
    await service.save(user("u1", "free"), base);
    await service.contact("sara-ahmed", { name: "Recruiter", email: "r@acme.test", message: "Let's talk about a role.", website: "spam.example" });
    expect(db.contactMessage.rows).toHaveLength(0);
    await service.contact("sara-ahmed", { name: "Recruiter", email: "r@acme.test", message: "Let's talk about a role." });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ template: "notice", to: "sara@example.com" });
    const inbox = await service.messages(user("u1", "free"));
    expect(inbox[0]!.read).toBe(false);
    await service.markRead(user("u1", "free"), inbox[0]!.id, true);
    expect((await service.mine(user("u1", "free"))).site!.unreadMessages).toBe(0);
  });

  it("connects a custom domain on paid plans once DNS points at us", async () => {
    await service.save(user("u1", "free"), base);
    await expect(service.setDomain(user("u1", "free"), "sara.dev")).rejects.toBeInstanceOf(PlanRequiredError);
    await expect(service.setDomain(user("u1", "standard"), "x.cvbuilder.app")).rejects.toBeInstanceOf(ValidationError);
    await expect(service.setDomain(user("u1", "standard"), "careers.uni.edu.pk")).rejects.toBeInstanceOf(ConflictError);
    const set = await service.setDomain(user("u1", "standard"), "https://Sara.dev/");
    expect(set.customDomain).toMatchObject({ domain: "sara.dev", verified: false, cnameTarget: "cvbuilder.pk" });
    expect((await service.verifyDomain(user("u1", "standard"))).customDomain.verified).toBe(false);
    expect(await domains.allowed("sara.dev")).toBe(false);
    dns["sara.dev"] = { cnames: [], ipv4: ["203.0.113.7"] };
    const ok = await service.verifyDomain(user("u1", "standard"));
    expect(ok.customDomain.verified).toBe(true);
    expect(ok.url).toBe("https://sara.dev");
    expect(await domains.allowed("sara.dev")).toBe(true);
  });

  it("allows certificates only for hosts we serve", async () => {
    await service.save(user("u1", "free"), base);
    expect(await domains.allowed("cvbuilder.pk")).toBe(true);
    expect(await domains.allowed("sara-ahmed.cvbuilder.app")).toBe(true);
    expect(await domains.allowed("nobody.cvbuilder.app")).toBe(false);
    expect(await domains.allowed("a.b.cvbuilder.app")).toBe(false);
    expect(await domains.allowed("careers.uni.edu.pk")).toBe(true);
    expect(await domains.allowed("random.example.org")).toBe(false);
    expect(await domains.resolveHost("careers.uni.edu.pk")).toEqual({ kind: "org", orgId: "o1" });
  });

  it("lets org admins brand their domain, keeping other branding keys", async () => {
    await expect(domains.orgBranding(user("u1", "free"), "o1")).rejects.toThrow(/owners and admins/);
    const saved = await domains.saveOrgBranding(user("u2", "free"), "o1", {
      productName: "Uni Careers",
      logoUrl: "",
      primaryColor: "#123456",
      accentColor: "",
      templateIds: ["modern"],
      hideBrand: true,
    });
    expect(saved.branding.productName).toBe("Uni Careers");
    expect(db.organization.rows[0]!.branding).toMatchObject({ extra: 1, primaryColor: "#123456" });
    expect(await domains.publicBranding("careers.uni.edu.pk")).toMatchObject({ orgName: "Uni", primaryColor: "#123456", hideBrand: true });
    expect(await domains.publicBranding("cvbuilder.pk")).toBeNull();
  });
});
