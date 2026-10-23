import { hasAttribution, type Touch } from "./attribution";

/** A browsing session: ends after 30 minutes without activity, or when a new campaign arrives. */
export type AnalyticsSession = { id: string; startedAt: number; lastActivity: number; touch: Touch };

export const SESSION_IDLE_MS = 30 * 60 * 1000;

const sameCampaign = (a: Touch, b: Touch) =>
  a.source === b.source && a.medium === b.medium && a.campaign === b.campaign && a.term === b.term && a.content === b.content;

/**
 * The session to use for activity at `now`. Keeps the current one unless it went idle, or the
 * page was opened from a different campaign (UTM tags), which starts a new session the way
 * most analytics tools count it. An outside referrer alone doesn't split a running session.
 */
export function nextSession(
  current: AnalyticsSession | null,
  now: number,
  pageTouch: Touch,
  newId: () => string,
): { session: AnalyticsSession; started: boolean } {
  const campaign = Boolean(pageTouch.source || pageTouch.medium || pageTouch.campaign);
  const expired = !current || now - current.lastActivity > SESSION_IDLE_MS || now < current.startedAt;
  if (!expired && !(campaign && !sameCampaign(current.touch, pageTouch))) {
    return { session: { ...current, lastActivity: now }, started: false };
  }
  const touch = hasAttribution(pageTouch) ? pageTouch : { landing: pageTouch.landing };
  return { session: { id: newId(), startedAt: now, lastActivity: now, touch }, started: true };
}
