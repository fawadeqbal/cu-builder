import type { ExtractedJob, Settings } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type Me = { id: string; email: string; name: string; plan: string };
export type ResumeSummary = { id: string; title: string; updatedAt?: string };
export type SavedApplication = { id: string; status: string; job: { id: string; title: string } };
export type SavedJob = { id: string; title: string; company: string };

/** Do Not Track and Global Privacy Control turn analytics off. */
function trackingAllowed(): boolean {
  const nav = (globalThis as { navigator?: { doNotTrack?: string | null; globalPrivacyControl?: boolean } }).navigator;
  return !(nav?.doNotTrack === "1" || nav?.globalPrivacyControl === true);
}

/** Calls the CV Builder API with the personal access token. */
export function createApi(settings: Settings, http: typeof fetch = fetch.bind(globalThis)) {
  const base = `${settings.appUrl}/api/v1`;
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await http(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${settings.token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, "NETWORK", `Can't reach ${settings.appUrl}. Check the address in settings.`);
    }
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? "HTTP_ERROR", json?.error?.message ?? `Request failed (${res.status})`);
    return json as T;
  }
  return {
    me: async () => (await request<{ user: Me | null }>("GET", "/session")).user,
    resumes: async () => (await request<{ items: ResumeSummary[] }>("GET", "/resumes")).items,
    resume: (id: string) => request<{ id: string; title: string; data: unknown }>("GET", `/resumes/${encodeURIComponent(id)}`),
    saveJob: (job: ExtractedJob) => request<SavedApplication>("POST", "/applications", { job: jobPayload(job) }),
    /** Saves the posting to "Saved jobs" (the same link is never saved twice). */
    createJob: (job: ExtractedJob) => request<SavedJob>("POST", "/jobs", jobPayload(job)),
    /** A product analytics event (no personal data). Failures are ignored: analytics never gets in the way. */
    track: async (anonymousId: string, name: "extension_tailor" | "application_added", props: Record<string, string> = {}): Promise<void> => {
      if (!trackingAllowed()) return;
      await request<void>("POST", "/events", { anonymousId, context: { client: "extension" }, events: [{ name, props: { from: "extension", ...props } }] }).catch(
        () => undefined,
      );
    },
  };
}

export type Api = ReturnType<typeof createApi>;

/** An extracted posting as the API's CreateJobSchema expects it. */
export function jobPayload(job: ExtractedJob) {
  return {
    title: job.title.trim().slice(0, 200) || "Job",
    company: job.company.trim().slice(0, 200),
    location: job.location.trim().slice(0, 200),
    url: /^https?:\/\//i.test(job.url) ? job.url.slice(0, 2000) : undefined,
    description: job.description.slice(0, 30_000),
    salary: job.salary.trim().slice(0, 120),
    remote: job.remote,
    source: "extension" as const,
  };
}

/** A friendly message for an API failure (plan limits link to pricing). */
export function explain(e: unknown): { text: string; pricing?: boolean; settings?: boolean } {
  if (e instanceof ApiError) {
    if (e.code === "PLAN_REQUIRED")
      return { text: `${e.message}. The free plan tracks a limited number of applications; upgrade to track more.`, pricing: true };
    if (e.status === 401) return { text: "Your key isn't valid any more. Create a new one in Account → Browser extension.", settings: true };
    if (e.code === "NETWORK") return { text: e.message, settings: true };
    return { text: e.message };
  }
  return { text: e instanceof Error ? e.message : "Something went wrong" };
}
