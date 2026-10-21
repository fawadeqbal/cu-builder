import { NotFoundError, PlanRequiredError } from "@cvb/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { InMemoryResumesRepository } from "./in-memory-resumes.repository.js";
import { ResumesService } from "./resumes.service.js";

const free: AuthUser = { id: "u1", email: "free@example.com", plan: "free" };
const premium: AuthUser = { id: "u2", email: "pro@example.com", plan: "premium" };
const base = { title: "My CV", templateId: "classic", accent: null, pageSize: "A4" as const };

describe("ResumesService", () => {
  let repo: InMemoryResumesRepository;
  let service: ResumesService;

  beforeEach(() => {
    repo = new InMemoryResumesRepository();
    service = new ResumesService(repo);
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
    expect(repo.versions).toEqual([{ resumeId: r.id, reason: "manual" }]);
    const copy = await service.duplicate(premium, r.id);
    expect(copy.title).toBe("Renamed (copy)");
  });
});
