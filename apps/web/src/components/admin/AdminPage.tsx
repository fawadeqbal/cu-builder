"use client";

import type {
  AdminMetricsDto,
  AdminUpdateUserDto,
  AdminUserDto,
  MeDto,
  Page,
  TemplateSettingDto,
  UpdateTemplateSettingDto,
} from "@cvb/contracts";
import { PLANS, TEMPLATE_TIERS, type Plan, type TemplateTier } from "@cvb/domain";
import { TEMPLATES } from "@cvb/templates/catalog";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  PageHeader,
  ProgressBar,
  SearchField,
  Select,
  Skeleton,
  StatTile,
  Switch,
  Tabs,
  TextField,
  TierBadge,
} from "@cvb/ui";
import { api } from "@/lib/api";
import { PLAN_LABEL } from "@/lib/plans";
import { keys } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { OrgsAdmin } from "./OrgsAdmin";
import { ExpertsAdmin } from "./ExpertsAdmin";
import { PricingAdmin } from "./PricingAdmin";
import { ReviewsAdmin } from "./ReviewsAdmin";
import { SiteSettingsAdmin } from "./SiteSettingsAdmin";

const TABS = ["overview", "users", "templates", "organisations", "experts", "pricing", "reviews", "settings"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  users: "Users",
  templates: "Templates",
  organisations: "Organisations",
  experts: "Experts",
  pricing: "Pricing",
  reviews: "Reviews",
  settings: "Site settings",
};

/** Internal console: numbers, users and the template catalog. Every call is checked by the API (role admin). */
export function AdminPage() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => TABS.find((t) => t === params.get("tab")) ?? "overview");
  return (
    <RequireAuth admin>
      {(me) => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <main className="mx-auto flex w-full max-w-(--layout-xl) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
            <PageHeader title="Admin" />
            <Tabs
              label="Admin sections"
              value={tab}
              onChange={setTab}
              items={TABS.map((t) => ({ id: t, label: TAB_LABEL[t] }))}
            />
            <div role="tabpanel" aria-label={TAB_LABEL[tab]}>
              {tab === "overview" && <Overview />}
              {tab === "users" && <Users me={me} />}
              {tab === "templates" && <Templates />}
              {tab === "organisations" && <OrgsAdmin />}
              {tab === "experts" && <ExpertsAdmin />}
              {tab === "pricing" && <PricingAdmin />}
              {tab === "reviews" && <ReviewsAdmin />}
              {tab === "settings" && <SiteSettingsAdmin />}
            </div>
          </main>
        </div>
      )}
    </RequireAuth>
  );
}

const FUNNEL = ["visit", "cv_started", "cv_completed", "pdf_downloaded", "signed_up", "checkout_started", "purchased"];
/** "cv_started" → "CV started". */
const eventLabel = (name: string) => {
  const s = name
    .replace(/_/g, " ")
    .replace(/^cv\b/, "CV")
    .replace(/^pdf\b/, "PDF");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function Overview() {
  const metrics = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: () => api.get<AdminMetricsDto>("/admin/metrics"),
  });
  const m = metrics.data;
  if (!m) return <Loading />;
  const counts = new Map(m.funnel.map((f) => [f.name, f.count]));
  const top = Math.max(1, ...FUNNEL.map((n) => counts.get(n) ?? 0));
  const first = counts.get(FUNNEL[0]!) ?? 0;
  const tiles = [
    ["Users", m.users.total, `${m.users.last7Days} new this week`, "users"],
    ["CVs", m.resumes, "not counting trash", "files"],
    ["Paying subscribers", m.paying, "active or in grace period", "credit"],
    ["Active passes", m.activePasses, "running right now", "clock"],
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <div className="cvb-stat-grid">
        {tiles.map(([label, value, hint, icon]) => (
          <StatTile key={label} label={label} value={value.toLocaleString()} hint={hint} icon={icon} />
        ))}
      </div>
      <Card title="Funnel, last 30 days" description="Percentages are of visits.">
        <ol className="flex flex-col gap-4">
          {FUNNEL.map((name, i) => {
            const n = counts.get(name) ?? 0;
            return (
              <li key={name}>
                <ProgressBar
                  value={n}
                  max={top}
                  label={eventLabel(name)}
                  valueLabel={
                    <>
                      {n.toLocaleString()}
                      {i > 0 && first > 0 && <span className="ms-2 text-ink-3">{Math.round((n / first) * 100)}%</span>}
                    </>
                  }
                />
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      <Skeleton height={96} shape="block" />
      <Skeleton height={240} shape="block" />
    </div>
  );
}

function Users({ me }: { me: MeDto }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const users = useInfiniteQuery({
    queryKey: ["admin", "users", query],
    queryFn: ({ pageParam }) =>
      api.get<Page<AdminUserDto>>(
        `/admin/users?limit=25${query ? `&q=${encodeURIComponent(query)}` : ""}${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AdminUpdateUserDto }) => api.patch(`/admin/users/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: keys.me });
    },
  });
  const rows = users.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <SearchField
        className="max-w-sm"
        label="Search users"
        placeholder="Search by email or name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {update.error && <Alert tone="danger">{update.error.message}</Alert>}
      <DataTable<AdminUserDto>
        caption="Users"
        rows={rows}
        rowKey={(u) => u.id}
        empty={users.isLoading ? undefined : "No users found."}
        columns={[
          {
            key: "user",
            label: "User",
            render: (u) => (
              <div className="flex min-w-48 flex-col">
                <span className="flex flex-wrap items-center gap-2 text-ink">
                  {u.name}
                  {u.banned && (
                    <Badge tone="danger" icon="lock">
                      Suspended
                    </Badge>
                  )}
                </span>
                <span className="cvb-caption font-normal" dir="ltr">
                  {u.email}
                </span>
              </div>
            ),
          },
          { key: "plan", label: "Plan now", render: (u) => PLAN_LABEL[u.plan] },
          {
            key: "basePlan",
            label: "Base plan",
            render: (u) => (
              <Select
                size="sm"
                className="[&_select]:py-1 min-w-32"
                aria-label={`Base plan for ${u.email}`}
                value={u.basePlan}
                onChange={(e) => update.mutate({ id: u.id, patch: { basePlan: e.target.value as Plan } })}
                options={PLANS.map((p) => ({ value: p, label: PLAN_LABEL[p] }))}
              />
            ),
          },
          {
            key: "role",
            label: "Role",
            render: (u) => (
              <Select
                size="sm"
                className="[&_select]:py-1 min-w-28"
                aria-label={`Role for ${u.email}`}
                disabled={u.id === me.id}
                value={u.role === "admin" ? "admin" : "user"}
                onChange={(e) => update.mutate({ id: u.id, patch: { role: e.target.value as "user" | "admin" } })}
                options={[
                  { value: "user", label: "User" },
                  { value: "admin", label: "Admin" },
                ]}
              />
            ),
          },
          { key: "resumes", label: "CVs", numeric: true, render: (u) => u.resumes },
          {
            key: "createdAt",
            label: "Joined",
            render: (u) => <span className="whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</span>,
          },
          {
            key: "actions",
            label: (
              <span className="relative block">
                <span className="cvb-sr">Actions</span>
              </span>
            ),
            render: (u) =>
              u.id !== me.id && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant={u.banned ? "secondary" : "ghost"}
                    icon={u.banned ? "undo" : "lock"}
                    className={u.banned ? undefined : "text-danger"}
                    onClick={() =>
                      (u.banned || window.confirm(`Suspend ${u.email}? They are signed out everywhere.`)) &&
                      update.mutate({ id: u.id, patch: { banned: !u.banned } })
                    }
                  >
                    {u.banned ? "Reinstate" : "Suspend"}
                  </Button>
                </div>
              ),
          },
        ]}
      />
      {users.hasNextPage && (
        <Button className="self-center" loading={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
          {users.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}

function Templates() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["admin", "templates"],
    queryFn: () => api.get<TemplateSettingDto[]>("/admin/templates"),
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTemplateSettingDto }) =>
      api.patch<TemplateSettingDto>(`/admin/templates/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "templates"] });
      void qc.invalidateQueries({ queryKey: keys.templateSettings });
    },
  });
  const byId = new Map((settings.data ?? []).map((s) => [s.templateId, s]));

  return (
    <DataTable<(typeof TEMPLATES)[number]>
      caption="Templates"
      rows={[...TEMPLATES]}
      rowKey={(t) => t.id}
      columns={[
        {
          key: "template",
          label: "Template",
          render: (t) => {
            const tier = byId.get(t.id)?.tier ?? t.tier;
            return (
              <div className="flex min-w-60 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  {/* The template's own accent colour (data, not interface). */}
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: t.accent }}
                    aria-hidden="true"
                  />
                  <span className="text-ink">{t.name}</span>
                  <TierBadge tier={tier} />
                </div>
                <span className="cvb-caption font-normal">{t.description}</span>
              </div>
            );
          },
        },
        {
          key: "enabled",
          label: "Published",
          render: (t) => (
            <Switch
              aria-label={`Publish ${t.name}`}
              checked={byId.get(t.id)?.enabled ?? true}
              onChange={(on) => update.mutate({ id: t.id, patch: { enabled: on } })}
            />
          ),
        },
        {
          key: "tier",
          label: "Tier",
          render: (t) => (
            <Select
              size="sm"
              className="[&_select]:py-1 min-w-40"
              aria-label={`Tier for ${t.name}`}
              value={byId.get(t.id)?.tier ?? ""}
              onChange={(e) =>
                update.mutate({ id: t.id, patch: { tier: (e.target.value || null) as TemplateTier | null } })
              }
              options={[
                { value: "", label: `Default (${t.tier})` },
                ...TEMPLATE_TIERS.map((x) => ({ value: x, label: x })),
              ]}
            />
          ),
        },
        {
          key: "order",
          label: "Order",
          render: (t) => {
            const s = byId.get(t.id);
            return (
              <TextField
                size="sm"
                inputClassName="py-1"
                type="number"
                className="w-24"
                aria-label={`Order for ${t.name}`}
                defaultValue={s?.sortOrder ?? ""}
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v !== (s?.sortOrder ?? null)) update.mutate({ id: t.id, patch: { sortOrder: v } });
                }}
              />
            );
          },
        },
      ]}
    />
  );
}
