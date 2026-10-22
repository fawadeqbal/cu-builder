import { ValidationError } from "@cvb/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemorySiteSettingsRepository } from "./site-settings.repository.js";
import { SiteSettingsService } from "./site-settings.service.js";

describe("SiteSettingsService", () => {
  let repo: InMemorySiteSettingsRepository;
  let now: number;
  let service: SiteSettingsService;

  beforeEach(() => {
    repo = new InMemorySiteSettingsRepository();
    now = 0;
    service = new SiteSettingsService(repo, () => now);
  });

  it("has no WhatsApp number until one is set", async () => {
    expect(await service.get()).toEqual({ whatsappNumber: "", whatsappMessage: "" });
  });

  it("stores the number as international digits", async () => {
    const s = await service.update({
      whatsappNumber: "+92 300 1234567",
      whatsappMessage: "  Hi, I need help with my CV ",
    });
    expect(s).toEqual({ whatsappNumber: "923001234567", whatsappMessage: "Hi, I need help with my CV" });
    expect(repo.rows.get("whatsapp.number")).toBe("923001234567");
  });

  it("refuses numbers that aren't international", async () => {
    await expect(service.update({ whatsappNumber: "0300 1234567", whatsappMessage: "" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("clears the number with an empty value", async () => {
    await service.update({ whatsappNumber: "+971 50 123 4567", whatsappMessage: "Hello" });
    await service.update({ whatsappNumber: "", whatsappMessage: "Hello" });
    expect((await service.get()).whatsappNumber).toBe("");
    expect(repo.rows.has("whatsapp.number")).toBe(false);
  });

  it("caches reads for a minute and refreshes after an update", async () => {
    await service.get();
    await service.get();
    expect(repo.reads).toBe(1);
    now = 61_000;
    await service.get();
    expect(repo.reads).toBe(2);
    await service.update({ whatsappNumber: "+44 7700 900123", whatsappMessage: "" });
    expect((await service.get()).whatsappNumber).toBe("447700900123");
  });
});
