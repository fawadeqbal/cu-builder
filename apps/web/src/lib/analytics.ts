"use client";

import type { ANALYTICS_EVENTS } from "@cvb/contracts";

type EventName = (typeof ANALYTICS_EVENTS)[number];
type Props = Record<string, string | number | boolean>;

const KEY = "cv-builder:anon-id";
const queue: { name: EventName; props?: Props }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function anonymousId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anonymous-session";
  }
}

function flush(): void {
  const events = queue.splice(0, 20);
  if (!events.length) return;
  const body = JSON.stringify({ anonymousId: anonymousId(), events });
  // keepalive lets the request finish when the page is closing.
  void fetch("/api/v1/events", { method: "POST", credentials: "include", keepalive: true, headers: { "content-type": "application/json" }, body }).catch(
    () => undefined,
  );
}

/** Records a funnel event (batched, privacy-friendly: no personal data). */
export function track(name: EventName, props?: Props): void {
  if (typeof window === "undefined") return;
  queue.push({ name, props });
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
}

/** Counts a visit once per browser session. */
export function trackVisit(): void {
  try {
    if (sessionStorage.getItem("cv-builder:visit")) return;
    sessionStorage.setItem("cv-builder:visit", "1");
  } catch {
    // No session storage: count it anyway.
  }
  track("visit", { path: window.location.pathname });
}
