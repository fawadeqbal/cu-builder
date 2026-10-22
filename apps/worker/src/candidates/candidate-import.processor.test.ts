import { emptyCV, type CV } from "@cvb/domain";
import { InMemoryStorage } from "@cvb/storage";
import { UnrecoverableError, type Job } from "bullmq";
import { describe, expect, it } from "vitest";
import type { ResumeParser } from "../resume-import/resume-parser.js";
import { CandidateImportProcessor } from "./candidate-import.processor.js";
import type { CandidateResults } from "./candidate-results.js";

const job = (attemptsMade = 0) =>
  ({ data: { candidateId: "c1", orgId: "o1", fileKey: "candidates/o1/a.pdf", fileName: "ali-khan.pdf", mimeType: "application/pdf" }, attemptsMade, opts: { attempts: 3 } }) as unknown as Job;

function setup(parse: ResumeParser["parse"]) {
  const calls: Record<string, unknown> = {};
  const results: CandidateResults = {
    markParsing: async () => true,
    complete: async (_id, r) => void (calls.complete = r),
    fail: async (_id, error) => void (calls.fail = error),
  };
  const files = new InMemoryStorage();
  return { calls, files, processor: new CandidateImportProcessor({ parse }, results, files), ready: files.put("candidates/o1/a.pdf", new Uint8Array([1])) };
}

describe("CandidateImportProcessor", () => {
  it("stores the CV with the fields to check and deletes the upload", async () => {
    const cv: CV = { ...emptyCV, personal: { ...emptyCV.personal, name: "Ali Khan", email: "ali@x.io" } };
    const s = setup(async () => ({ cv, warnings: [] }));
    await s.ready;
    expect(await s.processor.process(job())).toEqual({ ready: true });
    const done = s.calls.complete as { name: string; lowConfidence: { path: string }[] };
    expect(done.name).toBe("Ali Khan");
    expect(done.lowConfidence.map((f) => f.path)).toContain("personal.phone");
    await expect(s.files.get("candidates/o1/a.pdf")).rejects.toThrow();
  });

  it("fails for good on unreadable files", async () => {
    const s = setup(async () => {
      throw new UnrecoverableError("We couldn't read any text in this file.");
    });
    await s.ready;
    await expect(s.processor.process(job())).rejects.toBeInstanceOf(UnrecoverableError);
    expect(s.calls.fail).toMatch(/couldn't read/);
  });

  it("leaves retries to BullMQ for passing errors", async () => {
    const s = setup(async () => {
      throw new Error("disk busy");
    });
    await s.ready;
    await expect(s.processor.process(job(0))).rejects.toThrow("disk busy");
    expect(s.calls.fail).toBeUndefined();
  });
});
