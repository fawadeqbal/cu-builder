"use client";

import type { CreatedOrderDto, ExpertDto, ServiceInfoDto } from "@cvb/contracts";
import type { ServiceKind } from "@cvb/domain";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useResumes } from "@/lib/queries";
import { money, serviceKeys, turnaround, useCatalog } from "@/lib/services";
import { Dialog } from "../ui/Dialog";
import { btn, field, label } from "../ui/styles";

type Props = {
  open: boolean;
  onClose: () => void;
  /** A chosen expert; without one the order goes to the first available expert. */
  expert?: ExpertDto | null;
  initialKind?: ServiceKind;
  initialResumeId?: string;
};

/** Order a service: what, which CV, the intake questions, and (coaching) a time. Then pay. */
export function BookDialog({ open, onClose, expert, initialKind, initialResumeId }: Props) {
  const catalog = useCatalog();
  const kinds = useMemo(
    () => (catalog.data ?? []).filter((s) => (expert ? expert.services.includes(s.service) : s.kind !== "coaching")),
    [catalog.data, expert],
  );
  const [kind, setKind] = useState<ServiceKind | "">(initialKind ?? "");
  const info = kinds.find((k) => k.kind === kind) ?? kinds[0];
  return (
    <Dialog open={open} onClose={onClose} title={expert ? `Book ${expert.displayName}` : "Order an expert service"} size="lg">
      {!info ? (
        <p className="py-6 text-center text-sm text-stone-500">Loading…</p>
      ) : (
        <>
          <div className="mb-4">
            <label className={label} htmlFor="book-kind">
              Service
            </label>
            <select id="book-kind" className={field} value={info.kind} onChange={(e) => setKind(e.target.value as ServiceKind)}>
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.name} — {k.kind === "coaching" ? "from " + money(5900) : money(k.priceCents)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">
              {info.description} {info.turnaroundHours !== null && `Delivered within ${turnaround(info.turnaroundHours)}.`}
              {info.revisions > 0 && ` Includes ${info.revisions} revision round${info.revisions > 1 ? "s" : ""}.`}
            </p>
          </div>
          <BookForm key={info.kind} info={info} expert={expert ?? null} initialResumeId={initialResumeId} onClose={onClose} />
        </>
      )}
    </Dialog>
  );
}

function BookForm({ info, expert, initialResumeId, onClose }: { info: ServiceInfoDto; expert: ExpertDto | null; initialResumeId?: string; onClose: () => void }) {
  const router = useRouter();
  const resumes = useResumes(info.needsResume);
  const included = useQuery({ queryKey: serviceKeys.included, queryFn: () => api.get<{ available: boolean }>("/services/included") });
  const [resumeId, setResumeId] = useState(initialResumeId ?? "");
  const [intake, setIntake] = useState<Record<string, string>>({});
  const [duration, setDuration] = useState<45 | 60>(60);
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosenResume = resumeId || resumes.data?.items[0]?.id || "";
  const slots = useQuery({
    queryKey: serviceKeys.slots(expert?.userId ?? "", duration),
    queryFn: () => api.get<string[]>(`/experts/${expert!.userId}/slots?duration=${duration}`),
    enabled: info.kind === "coaching" && Boolean(expert),
  });
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots.data ?? []) {
      const d = new Date(s).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      m.set(d, [...(m.get(d) ?? []), s]);
    }
    return [...m.entries()];
  }, [slots.data]);
  const free = info.kind === "review" && included.data?.available;
  const price = info.kind === "coaching" ? (duration === 45 ? 5900 : 7900) : info.priceCents;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const out = await api.post<CreatedOrderDto>("/orders", {
        kind: info.kind,
        ...(expert ? { expertId: expert.userId } : {}),
        ...(info.needsResume ? { resumeId: chosenResume } : {}),
        intake,
        ...(info.kind === "coaching" ? { scheduledAt: slot, durationMin: duration } : {}),
      });
      if (out.checkoutUrl) window.location.assign(out.checkoutUrl);
      else {
        onClose();
        router.push(`/orders/${out.order.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {info.needsResume && (
        <div>
          <label className={label} htmlFor="book-cv">
            CV
          </label>
          <select id="book-cv" className={field} value={chosenResume} onChange={(e) => setResumeId(e.target.value)} required>
            {resumes.data?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          {resumes.data && resumes.data.items.length === 0 && <p className="mt-1 text-xs text-red-600">Create a CV first.</p>}
        </div>
      )}
      {info.intake.map((q) => (
        <div key={q.key}>
          <label className={label} htmlFor={`intake-${q.key}`}>
            {q.label}
            {!q.required && <span className="font-normal text-stone-400"> (optional)</span>}
          </label>
          {q.long ? (
            <textarea id={`intake-${q.key}`} rows={3} className={field} required={q.required} value={intake[q.key] ?? ""} maxLength={4000} onChange={(e) => setIntake({ ...intake, [q.key]: e.target.value })} />
          ) : (
            <input id={`intake-${q.key}`} className={field} required={q.required} value={intake[q.key] ?? ""} maxLength={4000} onChange={(e) => setIntake({ ...intake, [q.key]: e.target.value })} />
          )}
        </div>
      ))}
      {info.kind === "coaching" && expert && (
        <fieldset>
          <legend className={label}>Session</legend>
          <div className="mb-3 flex gap-4 text-sm text-stone-700">
            {([45, 60] as const).map((d) => (
              <label key={d} className="flex items-center gap-1.5">
                <input type="radio" name="duration" className="accent-brand" checked={duration === d} onChange={() => (setDuration(d), setSlot(""))} />
                {d} minutes · {money(d === 45 ? 5900 : 7900)}
              </label>
            ))}
          </div>
          {slots.isLoading ? (
            <p className="text-sm text-stone-500">Loading times…</p>
          ) : byDay.length === 0 ? (
            <p className="text-sm text-stone-500">No free times in the next two weeks. Message us or choose another coach.</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-3 overflow-y-auto" role="radiogroup" aria-label="Start time">
              {byDay.map(([day, times]) => (
                <div key={day}>
                  <div className="mb-1 text-xs font-semibold text-stone-500">{day}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {times.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={slot === t}
                        onClick={() => setSlot(t)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${slot === t ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300"}`}
                      >
                        {new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-stone-500">Times are in your time zone. You&apos;ll get a video call link and a calendar invite.</p>
        </fieldset>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <div className="text-sm">
          {free ? (
            <span className="font-semibold text-emerald-700">Included in your plan this month</span>
          ) : (
            <span className="font-semibold text-stone-900">{money(price)}</span>
          )}
          {!expert && <span className="block text-xs text-stone-500">We&apos;ll match you with the first available expert.</span>}
        </div>
        <button type="submit" className={btn.primary} disabled={busy || (info.kind === "coaching" && !slot) || (info.needsResume && !chosenResume)}>
          {busy ? "Placing order…" : free ? "Place order" : "Continue to payment"}
        </button>
      </div>
    </form>
  );
}
