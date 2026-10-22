"use client";

import type { CreatedOrderDto, ExpertDto, ServiceInfoDto } from "@cvb/contracts";
import type { ServiceKind } from "@cvb/domain";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useResumes } from "@/lib/queries";
import { money, serviceKeys, turnaround, useCatalog } from "@/lib/services";
import { Alert, Badge, Button, Icon, RadioGroup, Select, Spinner, TextArea, TextField } from "@cvb/ui";
import { Dialog } from "../ui/Dialog";

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
    <Dialog
      open={open}
      onClose={onClose}
      title={expert ? `Book ${expert.displayName}` : "Order an expert service"}
      size="lg"
    >
      {!info ? (
        <div className="grid place-items-center py-6">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            id="book-kind"
            label="Service"
            value={info.kind}
            onChange={(e) => setKind(e.target.value as ServiceKind)}
            hint={
              <>
                {info.description}{" "}
                {info.turnaroundHours !== null && `Delivered within ${turnaround(info.turnaroundHours)}.`}
                {info.revisions > 0 && ` Includes ${info.revisions} revision round${info.revisions > 1 ? "s" : ""}.`}
              </>
            }
            options={kinds.map((k) => ({
              value: k.kind,
              label: `${k.name} — ${k.kind === "coaching" ? "from " + money(5900) : money(k.priceCents)}`,
            }))}
          />
          <BookForm
            key={info.kind}
            info={info}
            expert={expert ?? null}
            initialResumeId={initialResumeId}
            onClose={onClose}
          />
        </div>
      )}
    </Dialog>
  );
}

function BookForm({
  info,
  expert,
  initialResumeId,
  onClose,
}: {
  info: ServiceInfoDto;
  expert: ExpertDto | null;
  initialResumeId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const resumes = useResumes(info.needsResume);
  const included = useQuery({
    queryKey: serviceKeys.included,
    queryFn: () => api.get<{ available: boolean }>("/services/included"),
  });
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
        <Select
          id="book-cv"
          label="CV"
          value={chosenResume}
          onChange={(e) => setResumeId(e.target.value)}
          required
          error={resumes.data && resumes.data.items.length === 0 ? "Create a CV first." : undefined}
          options={resumes.data?.items.map((r) => ({ value: r.id, label: r.title })) ?? []}
        />
      )}
      {info.intake.map((q) =>
        q.long ? (
          <TextArea
            key={q.key}
            id={`intake-${q.key}`}
            label={q.label}
            optional={!q.required}
            rows={3}
            required={q.required}
            value={intake[q.key] ?? ""}
            maxLength={4000}
            onChange={(e) => setIntake({ ...intake, [q.key]: e.target.value })}
          />
        ) : (
          <TextField
            key={q.key}
            id={`intake-${q.key}`}
            label={q.label}
            optional={!q.required}
            required={q.required}
            value={intake[q.key] ?? ""}
            maxLength={4000}
            onChange={(e) => setIntake({ ...intake, [q.key]: e.target.value })}
          />
        ),
      )}
      {info.kind === "coaching" && expert && (
        <div className="flex flex-col gap-3">
          <RadioGroup<"45" | "60">
            legend="Session"
            name="duration"
            orientation="horizontal"
            value={String(duration) as "45" | "60"}
            onChange={(v) => (setDuration(Number(v) as 45 | 60), setSlot(""))}
            options={([45, 60] as const).map((d) => ({
              value: String(d) as "45" | "60",
              label: <bdi>{`${d} minutes · ${money(d === 45 ? 5900 : 7900)}`}</bdi>,
            }))}
          />
          {slots.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-ink-3">
              <Spinner /> Loading times…
            </p>
          ) : byDay.length === 0 ? (
            <p className="text-sm text-ink-3">
              No free times in the next two weeks. Message us or choose another coach.
            </p>
          ) : (
            <div
              className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-md border border-line p-3"
              role="radiogroup"
              aria-label="Start time"
            >
              {byDay.map(([day, times]) => (
                <div key={day} className="flex flex-col gap-1.5">
                  <div className="cvb-overline">{day}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {times.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={slot === t}
                        onClick={() => setSlot(t)}
                        className="cvb-chip cvb-num aria-checked:border-brand aria-checked:bg-brand-soft aria-checked:text-ink"
                      >
                        {slot === t && <Icon name="check" size={16} />}
                        <bdi>{new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</bdi>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="cvb-caption">
            Times are in your time zone. You&apos;ll get a video call link and a calendar invite.
          </p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex flex-col gap-0.5">
          {free ? (
            <Badge tone="success" icon="check">
              Included in your plan this month
            </Badge>
          ) : (
            <span className="cvb-price">{money(price)}</span>
          )}
          {!expert && <span className="cvb-caption">We&apos;ll match you with the first available expert.</span>}
        </div>
        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={(info.kind === "coaching" && !slot) || (info.needsResume && !chosenResume)}
        >
          {busy ? "Placing order…" : free ? "Place order" : "Continue to payment"}
        </Button>
      </div>
    </form>
  );
}
