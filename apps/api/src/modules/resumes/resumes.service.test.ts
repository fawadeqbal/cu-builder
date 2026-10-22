import { NotFoundError, PlanRequiredError } from "@cvb/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { InMemoryResumesRepository } from "./in-memory-resumes.repository.js";
import { StaticTemplateCatalog } from "../templates/template-catalog.js";
import { ResumesService } from "./resumes.service.js";

const user = (id: string, plan: AuthUser["plan"]): AuthUser => ({
  id,
  email: `${id}@example.com`,
  name: id,
  role: "user",
  emailVerified: true,
  plan,
  planSource: "base",
});
const free = user("u1", "free");
const premium = user("u2", "premium");
const base = { title: "My CV", templateId: "classic", accent: null, pageSize: "A4" as const };

describe("ResumesService", () => {
  let repo: InMemoryResumesRepository;
  let service: ResumesService;

  beforeEach(() => {
    repo = new InMemoryResumesRepository();
    service = new ResumesService(repo, new StaticTemplateCatalog());
  });

  it("creates a resume with an empty CV by default", async () => {
    const r = await service.create(premium, base);
    expect(r.title).toBe("My CV");
    expect(r.data.personal.name).toBe("");
  });

  it("limits the free plan to one CV", async () => {
    await service.create(free, base);
    await expect(service.create(free, base)).rejects.toBeInstanceOf(PlanRequiredError);
  });

  it("gates templates by plan", async () => {
    await expect(service.create(free, { ...base, templateId: "executive" })).rejects.toBeInstanceOf(PlanRequiredError);
    await expect(service.create(premium, { ...base, templateId: "executive" })).resolves.toBeTruthy();
  });

  it("hides other people's resumes", async () => {
    const r = await service.create(premium, base);
    await expect(service.get(free, r.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("snapshots on request and duplicates", async () => {
    const r = await service.create(premium, base);
    await service.update(premium, r.id, { title: "Renamed", snapshot: true });
    expect(repo.versions.map((v) => v.reason)).toEqual(["manual"]);
    const copy = await service.duplicate(premium, r.id);
    expect(copy.title).toBe("Renamed (copy)");
  });

  it("takes a daily restore point while editing, and restores versions", async () => {
    const r = await service.create(premium, base);
    const data = { ...r.data, summary: "first" };
    await service.update(premium, r.id, { data });
    await service.update(premium, r.id, { data: { ...data, summary: "second" } });
    expect(repo.versions.map((v) => v.reason)).toEqual(["daily"]);

    const [v] = await service.versions(premium, r.id);
    const restored = await service.restoreVersion(premium, r.id, v!.id);
    expect(restored.data.summary).toBe("");
    expect((await service.versions(premium, r.id)).map((x) => x.reason)).toContain("before-restore");
  });

  it("moves deleted CVs to the trash and back", async () => {
    const r = await service.create(premium, base);
    await service.remove(premium, r.id);
    expect((await service.trash(premium)).map((x) => x.id)).toEqual([r.id]);
    await service.restoreFromTrash(premium, r.id);
    expect((await service.list(premium, { limit: 10 })).items).toHaveLength(1);
  });
});
