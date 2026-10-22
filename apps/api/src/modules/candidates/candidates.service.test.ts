import { normalizeCV } from "@cvb/domain";
import { InMemoryJobProducer } from "@cvb/queue";
import { ForbiddenError, ValidationError } from "@cvb/shared";
import { InMemoryStorage } from "@cvb/storage";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { InMemoryOrgsStore } from "../orgs/in-memory-orgs.store.js";
import { OrgsService } from "../orgs/orgs.service.js";
import { CandidatesService } from "./candidates.service.js";
import type { CandidatePatch, CandidateRecord, CandidatesStore } from "./candidates.store.js";

class MemCandidates implements CandidatesStore {
  rows: CandidateRecord[] = [];
  async create(input: Pick<CandidateRecord, "orgId" | "createdById" | "batchId" | "fileKey" | "fileName" | "mimeType" | "templateId">) {
    const c: CandidateRecord = { id: `c${this.rows.length + 1}`, name: "", status: "queued", data: null, lowConfidence: [], hideContacts: false, error: "", createdAt: new Date(), updatedAt: new Date(), ...input };
    this.rows.push(c);
    return c;
  }
  async list(orgId: string, batchId?: string) {
    return this.rows.filter((r) => r.orgId === orgId && (!batchId || r.batchId === batchId));
  }
  async find(id: string, orgId: string) {
    return this.rows.find((r) => r.id === id && r.orgId === orgId) ?? null;
  }
  async update(id: string, patch: CandidatePatch) {
    return Object.assign(this.rows.find((r) => r.id === id)!, patch);
  }
  async delete(id: string) {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}

const user = (id: string): AuthUser => ({ id, email: `${id}@example.com`, name: id, role: "user", emailVerified: true, plan: "free", planSource: "base" });
const pdf = (name: string) => ({ originalname: name, mimetype: "application/pdf", size: 20, buffer: Buffer.from("%PDF-1.7 hello world") });

describe("CandidatesService", () => {
  let jobs: InMemoryJobProducer;
  let storage: InMemoryStorage;
  let store: MemCandidates;
  let orgs: OrgsService;
  let service: CandidatesService;
  let orgId: string;

  beforeEach(async () => {
    jobs = new InMemoryJobProducer();
    storage = new InMemoryStorage();
    store = new MemCandidates();
    orgs = new OrgsService(new InMemoryOrgsStore(), jobs, { APP_URL: "https://app.test" });
    service = new CandidatesService(store, storage, jobs, orgs);
    orgId = (await orgs.create(user("boss"), { name: "Talent Co", kind: "agency" })).id;
  });

  it("stores each valid file and queues it for parsing", async () => {
    const out = await service.upload(user("boss"), orgId, [
      pdf("a.pdf"),
      { originalname: "notes.txt", mimetype: "text/plain", size: 5, buffer: Buffer.from("hello") },
      { ...pdf("huge.pdf"), size: 6 * 1024 * 1024 },
    ]);
    expect(out.accepted).toHaveLength(1);
    expect(out.rejected.map((r) => r.fileName)).toEqual(["notes.txt", "huge.pdf"]);
    expect(jobs.jobs.filter((j) => j.queue === "candidate-import")).toHaveLength(1);
    expect(store.rows[0]!.fileKey).toMatch(new RegExp(`^candidates/${orgId}/`));
    await expect(service.upload(user("boss"), orgId, Array.from({ length: 51 }, (_, i) => pdf(`${i}.pdf`)))).rejects.toBeInstanceOf(ValidationError);
  });

  it("keeps candidates to the agency team", async () => {
    await expect(service.list(user("outsider"), orgId)).rejects.toThrow();
    await expect(service.upload(user("outsider"), orgId, [pdf("a.pdf")])).rejects.toThrow();
  });

  it("edits a candidate and re-checks the flagged fields", async () => {
    const { accepted } = await service.upload(user("boss"), orgId, [pdf("a.pdf")]);
    const id = accepted[0]!.id;
    store.rows[0]!.lowConfidence = [
      { path: "personal.email", label: "Email", reason: "Not found" },
      { path: "personal.phone", label: "Phone", reason: "Not found" },
    ];
    const base = normalizeCV(null);
    const cv = { ...base, personal: { ...base.personal, name: "Ali", email: "ali@x.io" } };
    const updated = await service.update(user("boss"), orgId, id, { data: cv, hideContacts: true, templateId: "modern" });
    expect(updated.lowConfidence.map((f) => f.path)).toEqual(["personal.phone"]);
    expect(updated).toMatchObject({ name: "Ali", hideContacts: true, templateId: "modern" });
    await expect(service.update(user("boss"), orgId, id, { templateId: "nope" })).rejects.toBeInstanceOf(ValidationError);
    await service.remove(user("boss"), orgId, id);
    expect(store.rows).toHaveLength(0);
  });

  it("refuses members without candidate rights", async () => {
    const org = await orgs.get(user("boss"), orgId);
    await orgs.adminUpdate(orgId, { kind: "university", seats: 5 });
    await orgs.join(user("student"), org.inviteCode);
    await expect(service.list(user("student"), orgId)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
