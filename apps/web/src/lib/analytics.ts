"use client";

import type { ClientEventName, TouchDto, TrackDto } from "@cvb/contracts";
import { countryFromTimeZone, isCurrency, nextSession, normalisePath, touchFromUrl, type AnalyticsSession, type Touch } from "@cvb/domain";

/**
 * First-party, privacy-friendly analytics. Events go to our own API (`POST /api/v1/events`) and
 * stay in our Postgres. No cookies, no IP address, no personal data: a random id per browser
 * (localStorage), a 30-minute session id, the page path (ids and secret slugs removed, no query
 * except UTM tags), where the visit came from (UTM tags, the referring site's domain, the landing
 * page) and the interface language and currency. Device and browser family are worked out on
 * the server from the User-Agent, which isn't stored. Do Not Track and Global Privacy Control
 * switch it off completely: nothing is sent.
 *
 * Props must never hold personal data: no names, emails, CV text, job titles or free text.
 */

type Props = Record<string, string | number | boolean>;
type Queued = { name: ClientEventName; path: string; props?: Props };

const ANON_KEY = "cv-builder:anon-id";
const SESSION_KEY = "cv-builder:analytics-session";
const FIRST_KEY = "cv-builder:first-touch";
const CURRENCY_KEY = "cvb-currency";

const queue: Queued[] = [];
let queuedSession: AnalyticsSession | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
/** The page load's UTM tags and referrer count once, for the first event; later events are in-app navigation. */
let entryUsed = false;
let memorySession: AnalyticsSession | null = null;

const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the session lives in memory for this tab.
  }
};

const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

/** False when the browser sends Do Not Track or Global Privacy Control. */
export function trackingAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = typeof window !== "undefined" ? (window as Window & { doNotTrack?: string }) : undefined;
  return !(nav.globalPrivacyControl === true || nav.doNotTrack === "1" || nav.doNotTrack === "yes" || nav.msDoNotTrack === "1" || win?.doNotTrack === "1");
}

function anonymousId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anonymous-session";
  }
}

const currentPath = () => normalisePath(window.location.pathname);

/** The session for activity now: the stored one unless it went idle or a new campaign arrived. */
function currentSession(): AnalyticsSession {
  const pageTouch: Touch = entryUsed ? { landing: currentPath() } : touchFromUrl(window.location.href, document.referrer);
  entryUsed = true;
  const stored = read<AnalyticsSession>(SESSION_KEY) ?? memorySession;
  const { session } = nextSession(stored, Date.now(), pageTouch, uuid);
  memorySession = session;
  write(SESSION_KEY, session);
  if (!read<Touch>(FIRST_KEY)) write(FIRST_KEY, session.touch);
  return session;
}

const touchDto = (t: Touch | null): TouchDto | undefined => (t && Object.keys(t).length ? t : undefined);

function context(session: AnalyticsSession): NonNullable<TrackDto["context"]> {
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  let currency: string | null = null;
  try {
    currency = localStorage.getItem(CURRENCY_KEY);
  } catch {
    currency = null;
  }
  const locale = document.documentElement.lang || undefined;
  return {
    ...(locale ? { locale: locale.slice(0, 12) } : {}),
    ...(isCurrency(currency) ? { currency } : {}),
    ...(countryFromTimeZone(timeZone) ? { tzCountry: countryFromTimeZone(timeZone) } : {}),
    last: touchDto(session.touch),
    first: touchDto(read<Touch>(FIRST_KEY) ?? session.touch),
    client: "web",
  };
}

function flush(): void {
  clearTimeout(timer);
  const session = queuedSession;
  const events = queue.splice(0, 20);
  if (!events.length || !session) return;
  const body: TrackDto = { anonymousId: anonymousId(), sessionId: session.id, context: context(session), events };
  // keepalive lets the request finish when the page is closing.
  void fetch("/api/v1/events", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
  if (queue.length) flush();
}

/** Records a product event (batched). Never put personal data in `props`. */
export function track(name: ClientEventName, props?: Props): void {
  if (typeof window === "undefined" || !trackingAllowed()) return;
  const session = currentSession();
  // One batch per session, so every event carries its own session's attribution.
  if (queuedSession && queuedSession.id !== session.id) flush();
  queuedSession = session;
  queue.push({ name, path: currentPath(), ...(props ? { props } : {}) });
  if (queue.length >= 20) return flush();
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

let lastView = { path: "", at: 0 };

/** Counts a page view; the app calls it on every client-side route change. */
export function trackPageView(): void {
  if (typeof window === "undefined") return;
  const path = currentPath();
  // The admin console isn't product usage; and React may run the effect twice in development.
  if (path.startsWith("/admin")) return;
  const now = Date.now();
  if (path === lastView.path && now - lastView.at < 1000) return;
  lastView = { path, at: now };
  track("page_view");
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
