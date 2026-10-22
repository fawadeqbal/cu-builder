"use client";

import type { ExpertProfileBodyDto, MyExpertProfileDto, OrderDto } from "@cvb/contracts";
import { EXPERT_SERVICES } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PlusIcon, TrashIcon } from "@cvb/ui";
import { api } from "@/lib/api";
import { SERVICE_LABEL, money, serviceKeys, useMyExpertProfile, when } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { btn, card, field, label } from "../ui/styles";
import { StatusBadge } from "./OrdersPage";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The expert's side: apply, keep the profile and availability current, get paid, work the queue. */
export function ExpertWorkspace() {
  return <RequireAuth>{(me) => <Workspace name={me.name} />}</RequireAuth>;
}

function Workspace({ name }: { name: string }) {
  const profile = useMyExpertProfile();
  const [tab, setTab] = useState<"orders" | "profile" | "payouts">("orders");
  const p = profile.data;
  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Expert workspace</h1>
        {profile.isLoading ? (
          <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
        ) : !p ? (
          <>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">
              Recruiters, HR professionals and career coaches: review CVs, write them, or coach job seekers. You keep 75% of every order; we handle payments,
              scheduling and support.
            </p>
            <div className={`${card} mt-6 p-5 sm:p-6`}>
              <h2 className="mb-4 text-base font-semibold text-stone-900">Apply to become an expert</h2>
              <ProfileForm initial={null} defaultName={name} />
            </div>
          </>
        ) : (
          <>
            {p.status !== "approved" && (
              <p className={`mt-4 rounded-xl px-4 py-3 text-sm ring-1 ${p.status === "pending" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-red-50 text-red-700 ring-red-200"}`}>
                {p.status === "pending" ? "Thanks for applying. We review applications within two working days; you'll get an email when you're listed." : "Your profile is suspended. Contact support to find out more."}
              </p>
            )}
            <nav className="mt-4 flex gap-1 border-b border-stone-200 text-sm font-medium">
              {(
                [
                  ["orders", "Orders"],
                  ["profile", "Profile and availability"],
                  ["payouts", "Payouts"],
                ] as const
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${tab === id ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
                >
                  {text}
                </button>
              ))}
            </nav>
            <div className="mt-6">
              {tab === "orders" && <Assigned />}
              {tab === "profile" && (
                <div className={`${card} p-5 sm:p-6`}>
                  <ProfileForm initial={p} defaultName={name} />
                </div>
              )}
              {tab === "payouts" && <Payouts p={p} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Assigned() {
  const orders = useQuery({ queryKey: serviceKeys.assigned, queryFn: () => api.get<OrderDto[]>("/expert/orders") });
  const open = (orders.data ?? []).filter((o) => ["paid", "in_progress", "disputed"].includes(o.status));
  const rest = (orders.data ?? []).filter((o) => !open.includes(o));
  const row = (o: OrderDto) => {
    const late = o.dueAt && new Date(o.dueAt) < new Date() && ["paid", "in_progress"].includes(o.status);
    return (
      <li key={o.id}>
        <Link href={`/orders/${o.id}`} className={`${card} flex items-center gap-4 p-4 hover:border-stone-300`}>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-stone-900">{o.name}</div>
            <div className="text-xs text-stone-500">
              {o.buyer.name}
              {o.scheduledAt ? ` · session ${when(o.scheduledAt)}` : o.dueAt ? ` · due ${when(o.dueAt)}` : ""}
            </div>
          </div>
          {late && <span className="text-xs font-semibold text-red-600">Late</span>}
          {o.expertCents !== null && <span className="text-sm text-stone-600">{money(o.expertCents, o.currency)}</span>}
          <StatusBadge status={o.status} />
        </Link>
      </li>
    );
  };
  if (orders.isLoading) return <p className="py-10 text-center text-sm text-stone-500">Loading…</p>;
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-900">To do</h2>
        {open.length ? <ul className="flex flex-col gap-2">{open.map(row)}</ul> : <p className="text-sm text-stone-500">Nothing waiting. New orders arrive by email too.</p>}
      </section>
      {rest.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Earlier</h2>
          <ul className="flex flex-col gap-2">{rest.map(row)}</ul>
        </section>
      )}
    </div>
  );
}

const zones = () => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
};

function ProfileForm({ initial, defaultName }: { initial: MyExpertProfileDto | null; defaultName: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ExpertProfileBodyDto>(() => ({
    displayName: initial?.displayName ?? defaultName,
    headline: initial?.headline ?? "",
    bio: initial?.bio ?? "",
    photoUrl: initial?.photoUrl ?? null,
    specialties: initial?.specialties ?? [],
    languages: initial?.languages ?? ["English"],
    services: initial?.services ?? ["review"],
    timezone: initial?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    availability: initial?.availability ?? [],
    maxActiveOrders: initial?.maxActiveOrders ?? 5,
  }));
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => api.put<MyExpertProfileDto>("/expert/me", form),
    onSuccess: (p) => {
      qc.setQueryData(serviceKeys.me, p);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });
  const list = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  const toggle = (s: (typeof EXPERT_SERVICES)[number]) =>
    setForm((f) => ({ ...f, services: f.services.includes(s) ? f.services.filter((x) => x !== s) : [...f.services, s] }));

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="ex-name">
            Name shown to customers
          </label>
          <input id="ex-name" required minLength={2} maxLength={80} className={field} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="ex-headline">
            Headline
          </label>
          <input id="ex-headline" maxLength={160} className={field} placeholder="e.g. Tech recruiter, 10 years hiring engineers" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="ex-bio">
          About you
        </label>
        <textarea id="ex-bio" rows={5} maxLength={3000} className={field} placeholder="Your experience, who you help best, and how you work" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      </div>
      <fieldset>
        <legend className={label}>Services you offer</legend>
        <div className="flex flex-wrap gap-4 text-sm text-stone-700">
          {EXPERT_SERVICES.map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <input type="checkbox" className="size-4 accent-brand" checked={form.services.includes(s)} onChange={() => toggle(s)} />
              {SERVICE_LABEL[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="ex-spec">
            Specialties (comma-separated)
          </label>
          <input id="ex-spec" className={field} defaultValue={form.specialties.join(", ")} placeholder="Software, Finance, Graduates" onBlur={(e) => setForm({ ...form, specialties: list(e.target.value).slice(0, 10) })} />
        </div>
        <div>
          <label className={label} htmlFor="ex-lang">
            Languages (comma-separated)
          </label>
          <input id="ex-lang" className={field} defaultValue={form.languages.join(", ")} onBlur={(e) => setForm({ ...form, languages: list(e.target.value).slice(0, 10) })} />
        </div>
        <div>
          <label className={label} htmlFor="ex-photo">
            Photo link (optional)
          </label>
          <input id="ex-photo" type="url" className={field} placeholder="https://" value={form.photoUrl ?? ""} onChange={(e) => setForm({ ...form, photoUrl: e.target.value || null })} />
        </div>
        <div>
          <label className={label} htmlFor="ex-max">
            Most orders at once
          </label>
          <input id="ex-max" type="number" min={1} max={50} className={field} value={form.maxActiveOrders} onChange={(e) => setForm({ ...form, maxActiveOrders: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
        </div>
      </div>
      {form.services.includes("coaching") && <Availability form={form} setForm={setForm} />}
      {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className={btn.primary} disabled={save.isPending || form.services.length === 0}>
          {initial ? "Save profile" : "Send application"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </form>
  );
}

function Availability({ form, setForm }: { form: ExpertProfileBodyDto; setForm: (f: ExpertProfileBodyDto) => void }) {
  const all = zones();
  return (
    <fieldset className="rounded-xl p-4 ring-1 ring-stone-200">
      <legend className="px-1 text-sm font-semibold text-stone-900">Coaching availability</legend>
      <div className="mb-3 max-w-xs">
        <label className={label} htmlFor="ex-tz">
          Your time zone
        </label>
        {all.length ? (
          <select id="ex-tz" className={field} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {all.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        ) : (
          <input id="ex-tz" className={field} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        )}
      </div>
      <ul className="flex flex-col gap-2" aria-label="Weekly hours">
        {form.availability.map((w, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <select aria-label="Day" className={`${field} w-auto`} value={w.day} onChange={(e) => setForm({ ...form, availability: form.availability.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)) })}>
              {DAYS.map((d, n) => (
                <option key={d} value={n}>
                  {d}
                </option>
              ))}
            </select>
            <input aria-label="From" type="time" className={`${field} w-auto`} value={w.start} onChange={(e) => setForm({ ...form, availability: form.availability.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })} />
            <span className="text-sm text-stone-500">to</span>
            <input aria-label="Until" type="time" className={`${field} w-auto`} value={w.end} onChange={(e) => setForm({ ...form, availability: form.availability.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })} />
            <button type="button" className={btn.ghost} aria-label="Remove hours" onClick={() => setForm({ ...form, availability: form.availability.filter((_, j) => j !== i) })}>
              <TrashIcon className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`${btn.secondary} mt-3`}
        disabled={form.availability.length >= 30}
        onClick={() => setForm({ ...form, availability: [...form.availability, { day: 1, start: "09:00", end: "17:00" }] })}
      >
        <PlusIcon className="size-4" /> Add hours
      </button>
      <p className="mt-2 text-xs text-stone-500">Customers can book sessions inside these hours, at least 12 hours ahead.</p>
    </fieldset>
  );
}

function Payouts({ p }: { p: MyExpertProfileDto }) {
  const qc = useQueryClient();
  const params = useSearchParams();
  const connect = useMutation({
    mutationFn: () => api.post<{ url: string }>("/expert/payouts/connect"),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const refresh = useMutation({
    mutationFn: () => api.post<MyExpertProfileDto>("/expert/payouts/refresh"),
    onSuccess: (next) => qc.setQueryData(serviceKeys.me, next),
  });
  return (
    <section className={`${card} flex flex-col gap-3 p-5 sm:p-6`}>
      <h2 className="text-base font-semibold text-stone-900">Payouts</h2>
      <p className="text-sm text-stone-600">
        You&apos;re paid 75% of each order when the customer accepts it (or a week after delivery). Payments go to your bank through Stripe.
      </p>
      {!p.payoutsAvailable ? (
        <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600 ring-1 ring-stone-200">Payouts aren&apos;t set up on this server yet.</p>
      ) : p.payoutsEnabled ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">Payouts are ready.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} disabled={connect.isPending} onClick={() => connect.mutate()}>
            {p.payoutsConnected ? "Finish payout setup" : "Set up payouts"}
          </button>
          {(p.payoutsConnected || params.get("payouts")) && (
            <button type="button" className={btn.secondary} disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              Check status
            </button>
          )}
        </div>
      )}
      {(connect.error ?? refresh.error) && <p className="text-sm text-red-600">{(connect.error ?? refresh.error)!.message}</p>}
    </section>
  );
}
