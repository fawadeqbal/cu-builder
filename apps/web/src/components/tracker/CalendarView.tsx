"use client";

import type { ApplicationDto, ReminderDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties } from "react";
import { Button, IconButton } from "@cvb/ui";
import { api } from "@/lib/api";
import { useReminders } from "@/lib/tracker";

type Event = { id: string; at: Date; title: string; kind: "interview" | "deadline" | "reminder"; appId: string | null; reminder?: ReminderDto };

/** The inline-start edge of each event: interviews in the interview stage colour, deadlines warn, reminders inform. */
const KIND = {
  interview: { ["--stage" as string]: "var(--stage-interview)" },
  deadline: { ["--stage" as string]: "var(--warning)" },
  reminder: { ["--stage" as string]: "var(--info)" },
} as Record<Event["kind"], CSSProperties>;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** A month of interviews, deadlines and reminders. Monday first. */
export function CalendarView({ apps, onOpen }: { apps: ApplicationDto[]; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 42);
  const reminders = useReminders(start, end);
  const done = useMutation({
    mutationFn: (r: ReminderDto) => api.patch(`/reminders/${r.id}`, { done: !r.doneAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker", "reminders"] }),
  });

  const byDay = useMemo(() => {
    const events: Event[] = [];
    for (const a of apps) {
      const name = a.job.company || a.job.title;
      if (a.interviewAt) events.push({ id: `i-${a.id}`, at: new Date(a.interviewAt), title: `Interview: ${name}`, kind: "interview", appId: a.id });
      if (a.deadlineAt) events.push({ id: `d-${a.id}`, at: new Date(a.deadlineAt), title: `Deadline: ${name}`, kind: "deadline", appId: a.id });
    }
    for (const r of reminders.data ?? []) {
      if (r.kind === "interview" || r.kind === "deadline") continue; // the date itself is already shown
      events.push({ id: r.id, at: new Date(r.dueAt), title: r.title, kind: "reminder", appId: r.applicationId, reminder: r });
    }
    const map = new Map<string, Event[]>();
    for (const e of events.sort((a, b) => a.at.getTime() - b.at.getTime())) map.set(dayKey(e.at), [...(map.get(dayKey(e.at)) ?? []), e]);
    return map;
  }, [apps, reminders.data]);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = dayKey(new Date());
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="cvb-calendar">
      <div className="cvb-calendar-head">
        <h2 className="cvb-h3 flex-1">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        <IconButton icon="chevron-left" label="Previous month" size="sm" onClick={() => shift(-1)} />
        <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          Today
        </Button>
        <IconButton icon="chevron-right" label="Next month" size="sm" onClick={() => shift(1)} />
      </div>
      <div className="overflow-x-auto">
        <div className="cvb-calendar-grid min-w-[42rem]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="cvb-calendar-dow">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const events = byDay.get(dayKey(d)) ?? [];
            const inMonth = d.getMonth() === month.getMonth();
            return (
              <div key={d.toISOString()} className="cvb-calendar-day min-h-24" data-out={inMonth ? undefined : ""} data-today={dayKey(d) === today ? "" : undefined}>
                <span className="cvb-calendar-date">{d.getDate()}</span>
                <ul className="flex flex-col gap-1">
                  {events.map((e) => (
                    <li key={e.id} style={KIND[e.kind]} className={`cvb-event flex items-start gap-1 whitespace-normal ${e.reminder?.doneAt ? "line-through opacity-60" : ""}`}>
                      {e.reminder && (
                        <input type="checkbox" aria-label={`Done: ${e.title}`} className="mt-0.5 size-3 shrink-0 accent-brand" checked={Boolean(e.reminder.doneAt)} onChange={() => done.mutate(e.reminder!)} />
                      )}
                      <button type="button" className="min-w-0 flex-1 text-start font-normal leading-snug" disabled={!e.appId} onClick={() => e.appId && onOpen(e.appId)}>
                        <span className="cvb-num font-semibold">{e.at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span> {e.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
