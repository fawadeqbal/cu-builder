import { describe, expect, it } from "vitest";
import { AdzunaProvider, JobFeed, JoobleProvider, percentiles, RemotiveProvider, stripHtml, type FeedJob, type JobFeedProvider } from "./index";

const respond = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("providers", () => {
  it("maps Remotive jobs", async () => {
    const p = new RemotiveProvider(
      respond({ jobs: [{ id: 1, url: "https://remotive.com/j/1", title: "React Dev", company_name: "Acme", candidate_required_location: "Worldwide", salary: "$80k", description: "<p>Build <b>UI</b></p>", publication_date: "2026-10-01T00:00:00" }] }),
    );
    const [job] = await p.search({ keywords: "react" });
    expect(job).toMatchObject({ externalId: "remotive:1", title: "React Dev", company: "Acme", remote: true, description: "Build UI" });
  });

  it("maps Jooble and Adzuna jobs", async () => {
    const jooble = new JoobleProvider("k", respond({ jobs: [{ id: 9, title: "<b>Engineer</b>", company: "B", location: "Lahore", snippet: "Go", link: "https://j.example/9", updated: "2026-10-02" }] }));
    expect((await jooble.search({ keywords: "go" }))[0]).toMatchObject({ title: "Engineer", location: "Lahore", remote: false });
    const adzuna = new AdzunaProvider("id", "key", "gb", respond({ results: [{ id: 5, title: "Analyst", company: { display_name: "C" }, location: { display_name: "London" }, salary_min: 40000, salary_max: 50000, redirect_url: "https://a.example/5", description: "SQL" }] }));
    expect((await adzuna.search({ keywords: "sql" }))[0]).toMatchObject({ company: "C", salary: "40k–50k" });
  });
});

describe("JobFeed", () => {
  const job = (o: Partial<FeedJob>): FeedJob => ({ externalId: "x", source: "s", title: "T", company: "C", location: "", remote: false, salary: "", url: `https://x.example/${o.externalId ?? "x"}`, description: "", postedAt: null, ...o });
  const fixed = (id: string, jobs: FeedJob[]): JobFeedProvider => ({ id, search: async () => jobs });

  it("merges, de-duplicates, filters remote and survives a failing provider", async () => {
    const errors: string[] = [];
    const feed = new JobFeed(
      [
        fixed("a", [job({ externalId: "a1", title: "Dev", company: "Acme", remote: true, postedAt: "2026-10-01" })]),
        fixed("b", [job({ externalId: "b1", title: "dev ", company: "ACME", remote: true }), job({ externalId: "b2", title: "QA", remote: true, postedAt: "2026-10-05" })]),
        { id: "c", search: async () => Promise.reject(new Error("down")) },
      ],
      (p) => errors.push(p),
    );
    const out = await feed.search({ keywords: "dev", remote: true });
    expect(out.map((j) => j.externalId)).toEqual(["b2", "a1"]);
    expect(errors).toEqual(["c"]);
  });
});

describe("helpers", () => {
  it("strips html and computes percentiles", () => {
    expect(stripHtml("<ul><li>a</li><li>b</li></ul>")).toBe("- a\n- b");
    expect(percentiles({ "10000": 5, "20000": 10, "30000": 5 })).toEqual({ p25: 10000, median: 20000, p75: 20000, samples: 20 });
    expect(percentiles({ "10000": 2 })).toBeNull();
  });
});

describe("salary filter", () => {
  it("reads yearly figures and ignores other pay periods", async () => {
    const { salaryCeiling, meetsSalary } = await import("./index");
    expect(salaryCeiling("$170k - $200k")).toBe(200000);
    expect(salaryCeiling("£45,000–£55,000")).toBe(55000);
    expect(salaryCeiling("$1000 per task")).toBeNull();
    expect(salaryCeiling("$40/hour")).toBeNull();
    expect(salaryCeiling("")).toBeNull();
    expect(meetsSalary({ salary: "$80k" }, 100000)).toBe(false);
    expect(meetsSalary({ salary: "Competitive" }, 100000)).toBe(true);
  });
});

