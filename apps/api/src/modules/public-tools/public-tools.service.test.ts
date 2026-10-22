import { OfflineAssistant, type Assistant } from "@cvb/ai";
import { AtsCheckSchema, PUBLIC_AI_DAILY_LIMIT } from "@cvb/contracts";
import { emptyCV, sampleCV } from "@cvb/domain";
import { RateLimitedError, UpstreamError, ValidationError } from "@cvb/shared";
import { describe, expect, it } from "vitest";
import { AiService } from "../ai/ai.service.js";
import type { CreditsService } from "../ai/credits.service.js";
import { PublicToolsService, type Upload } from "./public-tools.service.js";
import { dailyWindow, InMemoryUsageQuota, visitorKey } from "./usage-quota.js";

const CV_TEXT = `Ayesha Khan
Data Analyst
ayesha.khan@example.com | +92 300 1234567 | Lahore, Pakistan

Summary
Data analyst with three years of experience turning sales and operations data into reports that managers use every week.

Experience
Data Analyst | Northwind Traders | Jan 2023 – Present
- Built a weekly sales dashboard in Power BI used by 40 branch managers
- Automated the monthly stock report with SQL and Python, saving 6 hours a month

Education
BS Statistics | Example University | 2018 – 2022

Skills
SQL, Python, Power BI, Excel`;

function setup(assistant: Assistant = new OfflineAssistant()) {
  const quota = new InMemoryUsageQuota();
  const svc = new PublicToolsService(assistant, quota, new AiService(assistant, {} as CreditsService));
  svc.now = () => new Date("2026-10-22T10:00:00Z");
  return { svc, quota };
}

const upload = (text: string | Uint8Array, name: string): Upload => {
  const buffer = Buffer.from(text);
  return { originalname: name, mimetype: "application/octet-stream", size: buffer.length, buffer };
};

const input = (v: Record<string, string> = {}) => AtsCheckSchema.parse(v);

describe("PublicToolsService.atsCheck", () => {
  it("scores pasted text and returns the CV as read", async () => {
    const { svc } = setup();
    const out = await svc.atsCheck(input({ text: CV_TEXT }));
    expect(out.cv.personal.name).toBe("Ayesha Khan");
    expect(out.cv.personal.email).toBe("ayesha.khan@example.com");
    expect(out.report.score).toBeGreaterThan(40);
    expect(out.report.issues.length).toBeGreaterThan(0);
    expect(out.source).toMatchObject({ kind: "text", fileType: null, pages: null });
    expect(out.source.words).toBeGreaterThan(50);
    expect(out.match).toBeNull();
  });

  it("reads an uploaded file and compares it with a job advert", async () => {
    const { svc } = setup();
    const advert = "We need a data analyst with strong SQL, Python and Tableau skills to build dashboards for our retail team.";
    const out = await svc.atsCheck(input({ jobTitle: "Data Analyst", jobDescription: advert }), upload(`<html><body><pre>${CV_TEXT}</pre></body></html>`, "cv.html"));
    expect(out.source.kind).toBe("file");
    expect(out.source.fileType).toBe("html");
    expect(out.match?.found).toEqual(expect.arrayContaining(["sql", "python"].map((k) => expect.stringMatching(new RegExp(k, "i")))));
    expect(out.match?.missing.some((k) => /tableau/i.test(k))).toBe(true);
  });

  it("treats empty multipart fields as not given", async () => {
    const { svc } = setup();
    await expect(svc.atsCheck(input({ text: "", jobDescription: "" }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("explains files it can't read", async () => {
    const { svc } = setup();
    await expect(svc.atsCheck(input(), upload(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), "cv.jpg"))).rejects.toThrow(/photo or scan/);
    await expect(svc.atsCheck(input(), upload(JSON.stringify(sampleCV), "cv.json"))).rejects.toThrow(/JSON file/);
    await expect(svc.atsCheck(input(), upload("%PDF-1.4 not really", "cv.pdf"))).rejects.toThrow(/couldn't be opened/);
    await expect(svc.atsCheck(input(), upload("Ayesha", "cv.txt"))).rejects.toThrow(/couldn't find any text/);
  });

  it("refuses files over 5 MB", async () => {
    const { svc } = setup();
    const big = { ...upload("x", "cv.txt"), size: 6 * 1024 * 1024 };
    await expect(svc.atsCheck(input(), big)).rejects.toThrow(/5 MB/);
  });

  it("gives up on a file that takes too long", async () => {
    const { svc } = setup();
    svc.extractTimeoutMs = 0;
    await expect(svc.atsCheck(input(), upload("%PDF-1.4 slow", "cv.pdf"))).rejects.toThrow(/too long|couldn't be opened/);
  });
});

describe("PublicToolsService free AI", () => {
  it(`allows ${PUBLIC_AI_DAILY_LIMIT} uses a day per visitor, then refuses`, async () => {
    const { svc } = setup();
    for (let i = 1; i <= PUBLIC_AI_DAILY_LIMIT; i++) {
      const out = await svc.improveBullet("1.2.3.4", { bullet: "responsible for the booking website" });
      expect(out.options.length).toBeGreaterThan(0);
      expect(out.usage).toMatchObject({ used: i, remaining: PUBLIC_AI_DAILY_LIMIT - i, aiConnected: false });
    }
    await expect(svc.improveBullet("1.2.3.4", { bullet: "made reports" })).rejects.toBeInstanceOf(RateLimitedError);
    expect((await svc.usage("1.2.3.4")).remaining).toBe(0);
    // Someone else still has their own allowance.
    expect((await svc.usage("5.6.7.8")).remaining).toBe(PUBLIC_AI_DAILY_LIMIT);
  });

  it("starts again the next day", async () => {
    const { svc } = setup();
    for (let i = 0; i < PUBLIC_AI_DAILY_LIMIT; i++) await svc.writeSummary("1.2.3.4", { cv: sampleCV });
    svc.now = () => new Date("2026-10-23T00:00:01Z");
    const usage = await svc.usage("1.2.3.4");
    expect(usage.remaining).toBe(PUBLIC_AI_DAILY_LIMIT);
    expect(usage.resetsAt).toBe("2026-10-24T00:00:00.000Z");
  });

  it("gives the use back when the AI fails", async () => {
    const failing = Object.assign(new OfflineAssistant(), { name: "claude", improveBullet: () => Promise.reject(new Error("overloaded")) });
    const { svc, quota } = setup(failing);
    await expect(svc.improveBullet("1.2.3.4", { bullet: "made reports" })).rejects.toBeInstanceOf(UpstreamError);
    expect(await quota.used(visitorKey("ai", "1.2.3.4", "2026-10-22"))).toBe(0);
  });

  it("doesn't send the photo to the model", async () => {
    let seen = "x";
    const spy = Object.assign(new OfflineAssistant(), {
      writeSummary: async ({ cv }: { cv: typeof emptyCV }) => {
        seen = cv.photo;
        return { options: ["One", "Two"] };
      },
    });
    const { svc } = setup(spy);
    await svc.writeSummary("1.2.3.4", { cv: { ...sampleCV, photo: "data:image/jpeg;base64,AAAA" } });
    expect(seen).toBe("");
  });
});

describe("usage quota helpers", () => {
  it("windows by UTC day and never keeps the raw IP", () => {
    expect(dailyWindow(new Date("2026-10-22T23:59:59Z"))).toEqual({ day: "2026-10-22", resetsAt: new Date("2026-10-23T00:00:00Z") });
    const key = visitorKey("ai", "203.0.113.9", "2026-10-22");
    expect(key).not.toContain("203.0.113.9");
    expect(key).toBe(visitorKey("ai", "203.0.113.9", "2026-10-22"));
    expect(key).not.toBe(visitorKey("ai", "203.0.113.9", "2026-10-23"));
  });

  it("forgets counts once the window ends", async () => {
    let t = 0;
    const quota = new InMemoryUsageQuota(() => t);
    await quota.take("k", new Date(1000));
    expect(await quota.used("k")).toBe(1);
    t = 1000;
    expect(await quota.used("k")).toBe(0);
  });
});
