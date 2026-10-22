import type { ApiError as ApiErrorBody } from "@cvb/contracts";

/** An error response from the API, with its stable code (see @cvb/shared ErrorCode). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const isApiError = (e: unknown, code?: string): e is ApiError => e instanceof ApiError && (!code || e.code === code);

/**
 * Thin client for /api/v1. Same origin (the web server or Caddy proxies /api), so the
 * session cookie goes with every request. Request and response types come from @cvb/contracts.
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined && !isForm ? { "content-type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (ApiErrorBody & T) | null;
  if (!res.ok) {
    const err = json?.error;
    throw new ApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<void>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
};
