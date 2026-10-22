import { describe, expect, it } from "vitest";
import { createJobFeed, JobFeed } from "./index";
import { ArbeitnowProvider, CompanyBoardsProvider, HimalayasProvider, matchesQuery, parseBoards, RemoteOkProvider, TtlCache } from "./sources";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("matchesQuery", () => {
  const job = { title: "Senior React Developer", description: "Next.js and TypeScript", location: "Berlin", remote: false };
  it("needs every keyword in the title, or in the description with one in the title", () => {
    expect(matchesQuery(job, { keywords: "react developer" })).toBe(true);
    expect(matchesQuery(job, { keywords: "react typescript" })).toBe(true);
    expect(matchesQuery(job, { keywords: "typescript" })).toBe(false);
    expect(matchesQuery(job, { keywords: "python" })).toBe(false);
  });
  it("checks the location unless the job is remote", () => {
    expect(matchesQuery(job, { keywords: "react", location: "berlin" })).toBe(true);
    expect(matchesQuery(job, { keywords: "react", location: "Lahore" })).toBe(false);
    expect(matchesQuery({ ...job, remote: true }, { keywords: "react", location: "Lahore" })).toBe(true);
  });
});

describe("parseBoards", () => {
  it("reads system:slug=Name and drops unknown systems", () => {
    expect(parseBoards("greenhouse:gitlab, ashby:ramp=Ramp, workday:x, lever:")).toEqual([
      { ats: "greenhouse", slug: "gitlab", name: undefined },
      { ats: "ashby", slug: "ramp", name: "Ramp" },
    ]);
  });
});

describe("providers", () => {
  it("Himalayas maps search results", async () => {
    const p = new HimalayasProvider("", async () =>
      json({ jobs: [{ title: "React Engineer", companyName: "Acme", locationRestrictions: [], minSalary: 90000, maxSalary: 120000, currency: "USD", applicationLink: "https://himalayas.app/x", guid: "g1", description: "<p>Hi</p>", pubDate: 1792087770 }] }),
    );
    const [j] = await p.search({ keywords: "react" });
    expect(j).toMatchObject({ source: "Himalayas", company: "Acme", remote: true, salary: "USD 90k–120k", url: "https://himalayas.app/x", description: "Hi" });
  });

  it("Arbeitnow and RemoteOK filter their snapshots locally", async () => {
    const a = new ArbeitnowProvider(1, async () =>
      json({ data: [{ slug: "a", title: "Backend Developer (NestJS)", company_name: "X", location: "Berlin", remote: true, url: "https://arbeitnow.com/a", description: "", created_at: 1792652468, tags: [] }, { slug: "b", title: "Sales", company_name: "Y", location: "Berlin", remote: false, url: "https://arbeitnow.com/b", description: "", created_at: 1, tags: [] }], links: { next: null } }),
    );
    expect((await a.search({ keywords: "nestjs developer" })).map((j) => j.externalId)).toEqual(["arbeitnow:a"]);
    const r = new RemoteOkProvider(async () => json([{ legal: "terms" }, { id: "1", position: "DevOps Engineer", company: "Z", location: "", url: "https://remoteok.com/1", tags: ["docker"], date: "2026-10-21T00:00:00Z" }]));
    expect(await r.search({ keywords: "docker" })).toHaveLength(1);
  });

  it("company boards read Greenhouse, Lever and Ashby, and skip a failing board", async () => {
    const errors: string[] = [];
    const http = async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("greenhouse")) return json({ jobs: [{ id: 1, title: "Frontend Engineer", company_name: "GitLab", location: { name: "Remote, EMEA" }, absolute_url: "https://gh/1", content: "&lt;p&gt;React&lt;/p&gt;", first_published: "2026-10-01T00:00:00Z" }] });
      if (u.includes("lever")) return json([{ id: "l1", text: "Frontend Engineer II", categories: { location: "London" }, workplaceType: "hybrid", hostedUrl: "https://lever/1", descriptionPlain: "React", createdAt: 1786469891368 }]);
      if (u.includes("ashby")) return new Response("nope", { status: 500 });
      throw new Error("unexpected");
    };
    const p = new CompanyBoardsProvider(parseBoards("greenhouse:gitlab, lever:spotify=Spotify, ashby:ramp"), http as typeof fetch, (b) => errors.push(b));
    const jobs = await p.search({ keywords: "frontend engineer" });
    expect(jobs.map((j) => [j.company, j.remote, j.description])).toEqual([
      ["GitLab", true, "React"],
      ["Spotify", false, "React"],
    ]);
    expect(errors).toEqual(["ashby:ramp"]);
  });
});

describe("JobFeed", () => {
  it("drops a copy of the same job that another source links to", async () => {
    const job = { externalId: "a", source: "Greenhouse", title: "Dev", company: "Acme", location: "", remote: true, salary: "", url: "https://acme.com/jobs/1", description: "", postedAt: null };
    const feed = new JobFeed([
      { id: "one", search: async () => [job] },
      { id: "two", search: async () => [{ ...job, externalId: "b", company: "ACME Inc", url: "https://www.acme.com/jobs/1/?ref=x" }] },
    ]);
    expect(await feed.search({ keywords: "dev" })).toHaveLength(1);
  });

  it("follows the built-in company list unless told otherwise", () => {
    expect(createJobFeed({}).providers.map((p) => p.id)).toEqual(["companies", "himalayas", "remotive", "arbeitnow", "remoteok"]);
    expect(createJobFeed({ JOBFEED_COMPANIES: "none" }).providers[0]!.id).toBe("himalayas");
  });
});

describe("TtlCache", () => {
  it("shares one load and retries after a failure", async () => {
    const c = new TtlCache<number>(60_000);
    let calls = 0;
    const load = async () => ++calls;
    await Promise.all([c.get("k", load), c.get("k", load)]);
    expect(calls).toBe(1);
    await c.get("bad", async () => Promise.reject(new Error("x"))).catch(() => {});
    await Promise.resolve();
    expect(await c.get("bad", async () => 7)).toBe(7);
  });

  it("serves the last good data while it reloads", async () => {
    const c = new TtlCache<number>(0);
    expect(await c.get("k", async () => 1)).toBe(1);
    let release: (v: number) => void = () => {};
    expect(await c.get("k", () => new Promise<number>((r) => (release = r)))).toBe(1);
    release(2);
    await new Promise((r) => setTimeout(r, 0));
    expect(await c.get("k", async () => 3)).toBe(2);
  });
});
