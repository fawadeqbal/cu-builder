/** Coaching availability: weekly windows in the expert's time zone → bookable UTC start times. */

export type WeeklyWindow = { day: number; start: string; end: string };
export type Booking = { start: Date; end: Date };

const MIN = 60_000;

/** Minutes the zone is ahead of UTC at `at` (e.g. +300 for Asia/Karachi). */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / MIN);
}

/** The UTC instant of a wall-clock time in a zone. */
export function zonedTime(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month, day, hour, minute);
  let at = guess - zoneOffsetMinutes(new Date(guess), timeZone) * MIN;
  // Re-check once in case the offset differs at the real instant (DST changes).
  at = guess - zoneOffsetMinutes(new Date(at), timeZone) * MIN;
  return new Date(at);
}

const hm = (s: string): [number, number] | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 24 && mi < 60 ? [h, mi] : null;
};

export function validWindow(w: WeeklyWindow): boolean {
  const a = hm(w.start);
  const b = hm(w.end);
  return Number.isInteger(w.day) && w.day >= 0 && w.day <= 6 && !!a && !!b && a[0] * 60 + a[1] < b[0] * 60 + b[1];
}

/**
 * Start times (UTC) where a session of `durationMin` fits inside a weekly window, starts at least
 * `minNoticeHours` from now, and doesn't overlap an existing booking. Starts every `stepMin`.
 */
export function availableSlots(input: {
  windows: WeeklyWindow[];
  timeZone: string;
  durationMin: number;
  now: Date;
  days?: number;
  booked?: Booking[];
  minNoticeHours?: number;
  stepMin?: number;
}): Date[] {
  const { windows, timeZone, durationMin, now } = input;
  const days = input.days ?? 14;
  const step = input.stepMin ?? 30;
  const earliest = now.getTime() + (input.minNoticeHours ?? 12) * 60 * MIN;
  const booked = input.booked ?? [];
  const out: Date[] = [];
  // Walk calendar days in the expert's zone.
  const offset = zoneOffsetMinutes(now, timeZone);
  const local = new Date(now.getTime() + offset * MIN);
  for (let d = 0; d <= days; d++) {
    const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + d));
    const weekday = date.getUTCDay();
    for (const w of windows.filter((x) => x.day === weekday && validWindow(x))) {
      const [sh, sm] = hm(w.start)!;
      const [eh, em] = hm(w.end)!;
      for (let m = sh * 60 + sm; m + durationMin <= eh * 60 + em; m += step) {
        const start = zonedTime(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), Math.floor(m / 60), m % 60, timeZone);
        const end = new Date(start.getTime() + durationMin * MIN);
        if (start.getTime() < earliest) continue;
        if (booked.some((b) => start < b.end && end > b.start)) continue;
        out.push(start);
      }
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime()).filter((d, i, all) => i === 0 || d.getTime() !== all[i - 1]!.getTime());
}

/** True when `start` is one of the bookable slots. */
export const isSlotAvailable = (slots: Date[], start: Date) => slots.some((s) => s.getTime() === start.getTime());

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);

/** A one-event calendar file (RFC 5545). */
export function icsEvent(e: { uid: string; start: Date; end: Date; title: string; description: string; url?: string; now?: Date }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CV Builder//Coaching//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(e.now ?? new Date())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(e.description)}`,
    ...(e.url ? [`URL:${e.url}`, `LOCATION:${icsText(e.url)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** "Add to Google Calendar" link. */
export function googleCalendarUrl(e: { start: Date; end: Date; title: string; description: string; location?: string }): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(e.start)}/${icsDate(e.end)}`,
    details: e.description,
    ...(e.location ? { location: e.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
