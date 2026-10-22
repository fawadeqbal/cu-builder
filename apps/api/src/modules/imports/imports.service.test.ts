import { LINKEDIN_EXPORT_MIME } from "@cvb/contracts";
import { InMemoryJobProducer } from "@cvb/queue";
import { InMemoryStorage } from "@cvb/storage";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import type { ResumesService } from "../resumes/resumes.service.js";
import type { ImportRecord, ImportsRepository } from "./imports.repository.js";
import { ImportsService, sniff } from "./imports.service.js";

const zip = (files: Record<string, string>) => Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));

const LINKEDIN = zip({
  "Profile.csv": "First Name,Last Name,Headline\nAyesha,Khan,Engineer\n",
  "Positions.csv": "Company Name,Title,Description,Location,Started On,Finished On\nArbisoft,Engineer,,,Jan 2020,\n",
  "messages.csv": "CONVERSATION ID,FROM,TO,CONTENT\n1,Ali,Ayesha,private message\n",
  "Connections.csv": "First Name,Last Name\nAli,Raza\n",
});

class MemoryImports implements ImportsRepository {
  rows: ImportRecord[] = [];
  async create(input: { userId: string; fileKey: string; fileName: string; mimeType: string }) {
    const r: ImportRecord = { ...input, id: `imp${this.rows.length + 1}`, status: "queued", error: null, warnings: [], resumeId: null, createdAt: new Date() };
    this.rows.push(r);
    return r;
  }
  async findOwned(id: string, userId: string) {
    return this.rows.find((r) => r.id === id && r.userId === userId) ?? null;
  }
  async listRecent(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async markFailed() {}
}

const user = { id: "u1" } as AuthUser;
const resumes = { assertCanAddResume: async () => undefined } as unknown as ResumesService;

describe("sniff", () => {
  it("tells LinkedIn exports, Word files and other ZIPs apart", () => {
    expect(sniff(LINKEDIN, "Basic_LinkedInDataExport.zip")).toBe(LINKEDIN_EXPORT_MIME);
    expect(sniff(zip({ "[Content_Types].xml": "<Types/>", "word/document.xml": "<w:document/>" }), "cv.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(sniff(zip({ "photos/me.jpg": "x" }), "photos.zip")).toMatchObject({ error: expect.stringMatching(/isn't a LinkedIn data export/) });
    expect(sniff(Buffer.from("%PDF-1.7 ..."), "cv.pdf")).toBe("application/pdf");
  });
});

describe("ImportsService.start", () => {
  it("stores only the CV files of a LinkedIn export and queues it", async () => {
    const storage = new InMemoryStorage();
    const jobs = new InMemoryJobProducer();
    const svc = new ImportsService(new MemoryImports(), storage, jobs, resumes);
    const dto = await svc.start(user, { originalname: "Basic_LinkedInDataExport_10-22-2026.zip", mimetype: "application/zip", size: LINKEDIN.length, buffer: LINKEDIN });
    expect(dto.status).toBe("queued");
    const [key, stored] = [...storage.files.entries()][0]!;
    expect(key).toMatch(/^imports\/u1\/.+\.zip$/);
    expect(Object.keys(unzipSync(stored)).sort()).toEqual(["Positions.csv", "Profile.csv"]);
    expect(jobs.jobs[0]).toMatchObject({ queue: "resume-import", payload: { mimeType: LINKEDIN_EXPORT_MIME } });
  });

  it("allows larger LinkedIn exports but keeps the 5 MB limit for CV files", async () => {
    const svc = new ImportsService(new MemoryImports(), new InMemoryStorage(), new InMemoryJobProducer(), resumes);
    const big = 6 * 1024 * 1024;
    await expect(svc.start(user, { originalname: "cv.pdf", mimetype: "application/pdf", size: big, buffer: Buffer.from("%PDF-1.7") })).rejects.toThrow(/5 MB/);
    await expect(svc.start(user, { originalname: "export.zip", mimetype: "application/zip", size: big, buffer: LINKEDIN })).resolves.toMatchObject({ status: "queued" });
    await expect(svc.start(user, { originalname: "export.zip", mimetype: "application/zip", size: 30 * 1024 * 1024, buffer: LINKEDIN })).rejects.toThrow(/25 MB/);
  });
});
