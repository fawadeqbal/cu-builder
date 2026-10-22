import type { Settings } from "./types";

export const DEFAULT_APP_URL = "http://localhost:3000";

export async function loadSettings(): Promise<Settings> {
  const s = (await chrome.storage.local.get(["appUrl", "token"])) as Partial<Settings>;
  return { appUrl: s.appUrl || DEFAULT_APP_URL, token: s.token || "" };
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ appUrl: normaliseAppUrl(s.appUrl), token: s.token.trim() });
}

/** "localhost:3000/" → "http://localhost:3000"; throws on anything that isn't an http(s) URL. */
export function normaliseAppUrl(raw: string): string {
  const v = raw.trim().replace(/\/+$/, "");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && !/^https?:\/\//i.test(v)) throw new Error("Use an http or https address");
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(v);
  const url = new URL(/^https?:\/\//i.test(v) ? v : `${local ? "http" : "https"}://${v}`);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Use an http or https address");
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/** The host permission pattern for the app ("https://cv.example.com/*"). */
export const originPattern = (appUrl: string) => `${new URL(appUrl).origin}/*`;

export const looksLikeToken = (t: string) => /^cvb_[\w-]{20,}$/.test(t.trim());
