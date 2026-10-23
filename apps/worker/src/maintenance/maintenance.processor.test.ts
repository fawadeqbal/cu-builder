import { InMemoryStorage } from "@cvb/storage";
import type { Queue } from "bullmq";
import { describe, expect, it } from "vitest";
import { MaintenanceProcessor } from "./maintenance.processor.js";
import type { MaintenanceStore } from "./maintenance.store.js";

describe("MaintenanceProcessor", () => {
  it("purges trash older than 30 days and upload files older than 7 days", async () => {
    const calls: Record<string, Date> = {};
    const forgotten: string[] = [];
    const store: MaintenanceStore = {
      purgeTrash: async (before) => ((calls.trash = before), 2),
      oldImportFiles: async (before) => ((calls.files = before), [{ id: "i1", fileKey: "imports/u/a.pdf" }]),
      forgetImportFile: async (id) => void forgotten.push(id),
      purgeExpiredTokens: async () => 5,
      purgeAnalytics: async (before) => ((calls.analytics = before), { events: 40, visitors: 3 }),
    };
    const files = new InMemoryStorage();
    await files.put("imports/u/a.pdf", new Uint8Array([1]));
    const processor = new MaintenanceProcessor(store, files, {} as Queue);
    const now = new Date("2026-10-22T03:17:00Z");

    const result = await processor.purge(now);

    expect(result).toEqual({ resumes: 2, files: 1, tokens: 5, events: 40, visitors: 3 });
    expect(calls.analytics?.toISOString()).toBe("2025-09-22T03:17:00.000Z");
    expect(calls.trash?.toISOString()).toBe("2026-09-22T03:17:00.000Z");
    expect(calls.files?.toISOString()).toBe("2026-10-15T03:17:00.000Z");
    expect(forgotten).toEqual(["i1"]);
    await expect(files.get("imports/u/a.pdf")).rejects.toThrow();
  });
});
