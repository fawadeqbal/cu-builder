"use client";

import type { ExpertProfileBodyDto, MyExpertProfileDto, OrderDto } from "@cvb/contracts";
import { EXPERT_SERVICES } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Icon,
  IconButton,
  PageHeader,
  Select,
  SideNav,
  Skeleton,
  Tabs,
  TextArea,
  TextField,
} from "@cvb/ui";
import { api } from "@/lib/api";
import { SERVICE_LABEL, money, serviceKeys, useMyExpertProfile, when } from "@/lib/services";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { StatusBadge } from "./OrdersPage";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The expert's side: apply, keep the profile and availability current, get paid, work the queue. */
export function ExpertWorkspace() {
  return <RequireAuth>{(me) => <Workspace name={me.name} />}</RequireAuth>;
}

type TabId = "orders" | "profile" | "payouts";
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "orders", label: "Orders", icon: "list" },
  { id: "profile", label: "Profile and availability", icon: "user" },
  { id: "payouts", label: "Payouts", icon: "credit" },
];

function Workspace({ name }: { name: string }) {
  const profile = useMyExpertProfile();
  const params = useSearchParams();
  // Returning from payout setup (?payouts=done|retry) opens the Payouts section.
  const tab: TabId = TABS.find((t) => t.id === params.get("tab"))?.id ?? (params.get("payouts") ? "payouts" : "orders");
  const href = (id: TabId) => `/expert?tab=${id}`;
  const p = profile.data;
  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6 [&_.cvb-table-wrap]:relative">
        <PageHeader
          title="Expert workspace"
          description={
            !profile.isLoading && !p
              ? "Recruiters, HR professionals and career coaches: review CVs, write them, or coach job seekers. You keep 75% of every order; we handle payments, scheduling and support."
              : undefined
          }
        />
        {profile.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton height={44} shape="block" />
            <Skeleton height={240} shape="block" />
          </div>
        ) : !p ? (
          <section className="flex flex-col gap-4" aria-labelledby="apply-title">
            <h2 id="apply-title" className="cvb-h2 text-ink">
              Apply to become an expert
            </h2>
            <ProfileForm initial={null} defaultName={name} />
          </section>
        ) : (
          <>
            {p.status !== "approved" && (
              <Alert
                tone={p.status === "pending" ? "info" : "danger"}
                icon={p.status === "pending" ? "clock" : undefined}
              >
                {p.status === "pending"
                  ? "Thanks for applying. We review applications within two working days; you'll get an email when you're listed."
                  : "Your profile is suspended. Contact support to find out more."}
              </Alert>
            )}
            <Tabs
              className="lg:hidden"
              label="Expert workspace"
              value={tab}
              items={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon, href: href(t.id) }))}
            />
            <div className="flex items-start gap-8">
              <aside className="sticky top-6 hidden shrink-0 lg:block">
                <SideNav
                  label="Expert workspace"
                  groups={[
                    {
                      items: TABS.map((t) => ({
                        href: href(t.id),
                        label: t.label,
                        icon: t.icon,
                        current: t.id === tab,
                      })),
                    },
                  ]}
                />
              </aside>
              <div className="flex min-w-0 flex-1 flex-col gap-6">
                {tab === "orders" && <Assigned />}
                {tab === "profile" && <ProfileForm initial={p} defaultName={name} />}
                {tab === "payouts" && <Payouts p={p} />}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Assigned() {
  const orders = useQuery({ queryKey: serviceKeys.assigned, queryFn: () => api.get<OrderDto[]>("/expert/orders") });
  const router = useRouter();
  const open = (orders.data ?? []).filter((o) => ["paid", "in_progress", "disputed"].includes(o.status));
  const rest = (orders.data ?? []).filter((o) => !open.includes(o));
  const [now] = useState(() => Date.now());
  const table = (rows: OrderDto[], caption: string, empty?: string) => (
    <DataTable<OrderDto>
      caption={caption}
      rows={rows}
      rowKey={(o) => o.id}
      onRowClick={(o) => router.push(`/orders/${o.id}`)}
      empty={empty}
      columns={[
        {
          key: "name",
          label: "Order",
          render: (o) => (
            <Link
              href={`/orders/${o.id}`}
              className="whitespace-nowrap hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {o.name}
            </Link>
          ),
        },
        { key: "buyer", label: "Customer", render: (o) => o.buyer.name },
        {
          key: "when",
          label: "Due",
          render: (o) => {
            const late = o.dueAt && new Date(o.dueAt).getTime() < now && ["paid", "in_progress"].includes(o.status);
            return (
              <span className="flex flex-wrap items-center gap-2 whitespace-nowrap">
                <span className="tabular-nums">
                  {o.scheduledAt ? `Session ${when(o.scheduledAt)}` : o.dueAt ? when(o.dueAt) : "Not set"}
                </span>
                {late && (
                  <Badge tone="danger" icon="alert-triangle">
                    Late
                  </Badge>
                )}
              </span>
            );
          },
        },
        {
          key: "share",
          label: "Your share",
          numeric: true,
          render: (o) => (o.expertCents !== null ? money(o.expertCents, o.currency) : ""),
        },
        { key: "status", label: "Status", render: (o) => <StatusBadge status={o.status} /> },
      ]}
    />
  );
  if (orders.isLoading)
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={48} shape="block" />
        ))}
      </div>
    );
  return (
    <>
      <section className="flex flex-col gap-3" aria-labelledby="queue-todo">
        <h2 id="queue-todo" className="cvb-h2 text-ink">
          To do
        </h2>
        {table(open, "To do", "Nothing waiting. New orders arrive by email too.")}
      </section>
      {rest.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="queue-earlier">
          <h2 id="queue-earlier" className="cvb-h2 text-ink">
            Earlier
          </h2>
          {table(rest, "Earlier")}
        </section>
      )}
    </>
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
    setForm((f) => ({
      ...f,
      services: f.services.includes(s) ? f.services.filter((x) => x !== s) : [...f.services, s],
    }));

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Card title="About you" description="What customers see on your profile.">
        <div className="cvb-field-row">
          <TextField
            id="ex-name"
            label="Name shown to customers"
            required
            minLength={2}
            maxLength={80}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
          <TextField
            id="ex-headline"
            label="Headline"
            maxLength={160}
            placeholder="e.g. Tech recruiter, 10 years hiring engineers"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
          />
        </div>
        <TextArea
          id="ex-bio"
          label="About you"
          rows={5}
          maxLength={3000}
          placeholder="Your experience, who you help best, and how you work"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <TextField
          id="ex-photo"
          label="Photo link"
          optional
          type="url"
          placeholder="https://"
          value={form.photoUrl ?? ""}
          onChange={(e) => setForm({ ...form, photoUrl: e.target.value || null })}
        />
      </Card>
      <Card title="What you offer">
        <fieldset className="cvb-fieldset">
          <legend className="cvb-legend">Services you offer</legend>
          <div className="cvb-fieldset cvb-fieldset-row">
            {EXPERT_SERVICES.map((s) => (
              <Checkbox
                key={s}
                label={SERVICE_LABEL[s]}
                checked={form.services.includes(s)}
                onChange={() => toggle(s)}
              />
            ))}
          </div>
        </fieldset>
        <div className="cvb-field-row">
          <TextField
            id="ex-spec"
            label="Specialties (comma-separated)"
            defaultValue={form.specialties.join(", ")}
            placeholder="Software, Finance, Graduates"
            onBlur={(e) => setForm({ ...form, specialties: list(e.target.value).slice(0, 10) })}
          />
          <TextField
            id="ex-lang"
            label="Languages (comma-separated)"
            defaultValue={form.languages.join(", ")}
            onBlur={(e) => setForm({ ...form, languages: list(e.target.value).slice(0, 10) })}
          />
          <TextField
            id="ex-max"
            label="Most orders at once"
            type="number"
            min={1}
            max={50}
            value={form.maxActiveOrders}
            onChange={(e) =>
              setForm({ ...form, maxActiveOrders: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })
            }
          />
        </div>
      </Card>
      {form.services.includes("coaching") && <Availability form={form} setForm={setForm} />}
      {save.error && <Alert tone="danger">{save.error.message}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={save.isPending} disabled={form.services.length === 0}>
          {initial ? "Save profile" : "Send application"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-success" role="status">
            <Icon name="check" size={16} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

function Availability({ form, setForm }: { form: ExpertProfileBodyDto; setForm: (f: ExpertProfileBodyDto) => void }) {
  const all = zones();
  return (
    <Card
      title="Coaching availability"
      description="Customers can book sessions inside these hours, at least 12 hours ahead."
    >
      <div className="max-w-xs">
        {all.length ? (
          <Select
            id="ex-tz"
            label="Your time zone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            options={all}
          />
        ) : (
          <TextField
            id="ex-tz"
            label="Your time zone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        )}
      </div>
      <ul className="flex flex-col gap-2" aria-label="Weekly hours">
        {form.availability.map((w, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Day"
              className="w-40"
              value={w.day}
              onChange={(e) =>
                setForm({
                  ...form,
                  availability: form.availability.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)),
                })
              }
              options={DAYS.map((d, n) => ({ value: String(n), label: d }))}
            />
            <TextField
              aria-label="From"
              type="time"
              className="w-32"
              value={w.start}
              onChange={(e) =>
                setForm({
                  ...form,
                  availability: form.availability.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                })
              }
            />
            <span className="text-sm text-ink-3">to</span>
            <TextField
              aria-label="Until"
              type="time"
              className="w-32"
              value={w.end}
              onChange={(e) =>
                setForm({
                  ...form,
                  availability: form.availability.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                })
              }
            />
            <IconButton
              icon="trash"
              label="Remove hours"
              onClick={() => setForm({ ...form, availability: form.availability.filter((_, j) => j !== i) })}
            />
          </li>
        ))}
      </ul>
      <Button
        icon="plus"
        className="self-start"
        disabled={form.availability.length >= 30}
        onClick={() =>
          setForm({ ...form, availability: [...form.availability, { day: 1, start: "09:00", end: "17:00" }] })
        }
      >
        Add hours
      </Button>
    </Card>
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
    <Card
      title="Payouts"
      description="You're paid 75% of each order when the customer accepts it (or a week after delivery). Payments go to your bank through Stripe."
    >
      {!p.payoutsAvailable ? (
        <Alert>Payouts aren&apos;t set up on this server yet.</Alert>
      ) : p.payoutsEnabled ? (
        <Alert tone="success">Payouts are ready.</Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={connect.isPending} onClick={() => connect.mutate()}>
            {p.payoutsConnected ? "Finish payout setup" : "Set up payouts"}
          </Button>
          {(p.payoutsConnected || params.get("payouts")) && (
            <Button disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              Check status
            </Button>
          )}
        </div>
      )}
      {(connect.error ?? refresh.error) && <Alert tone="danger">{(connect.error ?? refresh.error)!.message}</Alert>}
    </Card>
  );
}
