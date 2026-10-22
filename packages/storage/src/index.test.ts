import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalDiskStorage } from "./index";

describe("LocalDiskStorage", () => {
  it("round-trips files and refuses path tricks", async () => {
    const store = new LocalDiskStorage(await mkdtemp(path.join(os.tmpdir(), "cvb-")));
    await store.put("imports/u1/a.pdf", new Uint8Array([1, 2, 3]), "application/pdf");
    expect([...(await store.get("imports/u1/a.pdf"))]).toEqual([1, 2, 3]);
    await expect(store.put("../etc/passwd", new Uint8Array(), "text/plain")).rejects.toThrow();
    await store.delete("imports/u1/a.pdf");
    await expect(store.get("imports/u1/a.pdf")).rejects.toThrow();
  });
});
