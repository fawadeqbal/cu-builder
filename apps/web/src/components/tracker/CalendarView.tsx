"use client";

import type { ApplicationDto, ReminderDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useReminders } from "@/lib/tracker";
import { btn, card } from "../ui/styles";

type Event = { id: string; at: Date; title: string; kind: "interview" | "deadline" | "reminder"; appId: string | null; reminder?: ReminderDto };

const KIND = {
  interview: "bg-violet-50 text-violet-800 ring-violet-200",
  deadline: "bg-amber-50 text-amber-900 ring-amber-200",
  reminder: "bg-sky-50 text-sky-800 ring-sky-200",
};

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
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
        <h2 className="flex-1 text-base font-semibold text-stone-900">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        <button type="button" className={btn.ghost} aria-label="Previous month" onClick={() => shift(-1)}>
          ←
        </button>
        <button type="button" className={btn.ghost} onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          Today
        </button>
        <button type="button" className={btn.ghost} aria-label="Next month" onClick={() => shift(1)}>
          →
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const events = byDay.get(dayKey(d)) ?? [];
          const inMonth = d.getMonth() === month.getMonth();
          return (
            <div key={d.toISOString()} className={`min-h-24 border-b border-r border-stone-100 p-1.5 ${inMonth ? "" : "bg-stone-50/60"}`}>
              <div className={`mb-1 text-right text-xs ${dayKey(d) === today ? "font-bold text-brand" : inMonth ? "text-stone-600" : "text-stone-300"}`}>{d.getDate()}</div>
              <ul className="flex flex-col gap-1">
                {events.map((e) => (
                  <li key={e.id} className={`flex items-start gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-snug ring-1 ${KIND[e.kind]} ${e.reminder?.doneAt ? "opacity-50 line-through" : ""}`}>
                    {e.reminder && (
                      <input type="checkbox" aria-label={`Done: ${e.title}`} className="mt-0.5 size-3 accent-brand" checked={Boolean(e.reminder.doneAt)} onChange={() => done.mutate(e.reminder!)} />
                    )}
                    <button type="button" className="min-w-0 flex-1 text-left" disabled={!e.appId} onClick={() => e.appId && onOpen(e.appId)}>
                      <span className="font-semibold">{e.at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span> {e.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
