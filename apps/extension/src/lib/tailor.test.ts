import { describe, expect, it } from "vitest";
import { createApi, jobPayload } from "./api";
import { startTailoring, tailorProblem, tailorUrl } from "./tailor";
import type { ExtractedJob } from "./types";

const job: ExtractedJob = {
  title: " Senior React Developer ",
  company: "Acme Corp",
  location: "Lahore",
  url: "https://www.linkedin.com/jobs/view/4012345678/",
  description: "We are hiring a senior React developer to build our design system with TypeScript, testing and accessibility in mind.",
  salary: "",
  remote: true,
  via: "linkedin",
};

describe("tailoring from the extension", () => {
  it("builds the web app link that starts tailoring", () => {
    expect(tailorUrl("https://cv.example.com", "job_1", "res 2")).toBe("https://cv.example.com/jobs?tab=saved&job=job_1&resume=res+2&tailor=1");
  });

  it("explains what is missing before sending anything", () => {
    expect(tailorProblem(job, "")?.problem).toBe("no-cv");
    expect(tailorProblem({ ...job, title: " " }, "r1")?.problem).toBe("no-title");
    expect(tailorProblem({ ...job, description: "Short" }, "r1")?.problem).toBe("no-description");
    expect(tailorProblem(job, "r1")).toBeNull();
  });

  it("saves the job through POST /jobs with the personal key, then returns the link", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const http = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "job_9", title: "Senior React Developer", company: "Acme Corp" }), { status: 201 });
    }) as unknown as typeof fetch;
    const api = createApi({ appUrl: "http://localhost:3000", token: "cvb_test" }, http);
    const link = await startTailoring(api, "http://localhost:3000", job, "res_1");
    expect(link).toBe("http://localhost:3000/jobs?tab=saved&job=job_9&resume=res_1&tailor=1");
    expect(calls[0]!.url).toBe("http://localhost:3000/api/v1/jobs");
    expect(calls[0]!.init.method).toBe("POST");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer cvb_test");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ title: "Senior React Developer", source: "extension", remote: true, url: job.url });
  });

  it("does not call the API when something is missing", async () => {
    let called = false;
    const api = { createJob: async () => ((called = true), { id: "x", title: "", company: "" }) };
    await expect(startTailoring(api, "http://localhost:3000", { ...job, description: "" }, "r1")).rejects.toThrow(/job description/);
    expect(called).toBe(false);
  });

  it("drops links that aren't web addresses", () => {
    expect(jobPayload({ ...job, url: "chrome://newtab" }).url).toBeUndefined();
    expect(jobPayload({ ...job, title: "" }).title).toBe("Job");
  });
});
