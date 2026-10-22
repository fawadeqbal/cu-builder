"use client";

import type { AdminMetricsDto, AdminUpdateUserDto, AdminUserDto, MeDto, Page, TemplateSettingDto, UpdateTemplateSettingDto } from "@cvb/contracts";
import { PLANS, TEMPLATE_TIERS, type Plan, type TemplateTier } from "@cvb/domain";
import { TEMPLATES } from "@cvb/templates/catalog";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { TierBadge } from "@cvb/ui";
import { api } from "@/lib/api";
import { PLAN_LABEL } from "@/lib/plans";
import { keys } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { btn, card, field } from "../ui/styles";

type Tab = "overview" | "users" | "templates";

/** Internal console: numbers, users and the template catalog. Every call is checked by the API (role admin). */
export function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <RequireAuth admin>
      {(me) => (
        <div className="min-h-dvh bg-stone-50">
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Admin</h1>
            <nav className="mt-4 flex gap-1 border-b border-stone-200 text-sm font-medium">
              {(["overview", "users", "templates"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 capitalize ${tab === t ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
                  {t}
                </button>
              ))}
            </nav>
            <div className="mt-6">
              {tab === "overview" && <Overview />}
              {tab === "users" && <Users me={me} />}
              {tab === "templates" && <Templates />}
            </div>
          </main>
        </div>
      )}
    </RequireAuth>
  );
}

const FUNNEL = ["visit", "cv_started", "cv_completed", "pdf_downloaded", "signed_up", "checkout_started", "purchased"];

function Overview() {
  const metrics = useQuery({ queryKey: ["admin", "metrics"], queryFn: () => api.get<AdminMetricsDto>("/admin/metrics") });
  const m = metrics.data;
  if (!m) return <p className="text-sm text-stone-500">Loading…</p>;
  const counts = new Map(m.funnel.map((f) => [f.name, f.count]));
  const top = Math.max(1, ...FUNNEL.map((n) => counts.get(n) ?? 0));
  const tiles = [
    ["Users", m.users.total, `${m.users.last7Days} new this week`],
    ["CVs", m.resumes, "not counting trash"],
    ["Paying subscribers", m.paying, "active or in grace period"],
    ["Active passes", m.activePasses, "running right now"],
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className={`${card} p-5`}>
            <div className="text-sm text-stone-500">{label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-stone-900">{value.toLocaleString()}</div>
            <div className="mt-1 text-xs text-stone-500">{hint}</div>
          </div>
        ))}
      </div>
      <section className={`${card} p-5`}>
        <h2 className="text-base font-semibold text-stone-900">Funnel, last 30 days</h2>
        <p className="text-xs text-stone-500">Percentages are of visits.</p>
        <ol className="mt-4 flex flex-col gap-2.5">
          {FUNNEL.map((name, i) => {
            const n = counts.get(name) ?? 0;
            const first = counts.get(FUNNEL[0]!) ?? 0;
            return (
              <li key={name} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 text-sm">
                <span className="text-stone-700">{name.replace(/_/g, " ")}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(n / top) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-stone-600">
                  {n.toLocaleString()}
                  {i > 0 && first > 0 && <span className="ml-1 text-xs text-stone-400">{Math.round((n / first) * 100)}%</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
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
      api.get<Page<AdminUserDto>>(`/admin/users?limit=25${query ? `&q=${encodeURIComponent(query)}` : ""}${pageParam ? `&cursor=${pageParam}` : ""}`),
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
      <input className={`${field} max-w-sm`} placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      {update.error && <p className="text-sm text-red-600">{update.error.message}</p>}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Plan now</th>
              <th className="px-4 py-3 font-semibold">Base plan</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">CVs</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id} className={u.banned ? "bg-red-50/40" : ""}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-900">{u.name}</div>
                    <div className="text-xs text-stone-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">{PLAN_LABEL[u.plan]}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Base plan for ${u.email}`}
                      className="rounded-md border-0 bg-transparent py-1 text-sm ring-1 ring-stone-200"
                      value={u.basePlan}
                      onChange={(e) => update.mutate({ id: u.id, patch: { basePlan: e.target.value as Plan } })}
                    >
                      {PLANS.map((p) => (
                        <option key={p} value={p}>
                          {PLAN_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Role for ${u.email}`}
                      disabled={self}
                      className="rounded-md border-0 bg-transparent py-1 text-sm ring-1 ring-stone-200 disabled:opacity-50"
                      value={u.role === "admin" ? "admin" : "user"}
                      onChange={(e) => update.mutate({ id: u.id, patch: { role: e.target.value as "user" | "admin" } })}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{u.resumes}</td>
                  <td className="px-4 py-3 text-stone-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {!self && (
                      <button
                        type="button"
                        className={`text-sm font-medium ${u.banned ? "text-stone-700" : "text-red-600"} hover:underline`}
                        onClick={() => (u.banned || window.confirm(`Suspend ${u.email}? They are signed out everywhere.`)) && update.mutate({ id: u.id, patch: { banned: !u.banned } })}
                      >
                        {u.banned ? "Reinstate" : "Suspend"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !users.isLoading && <p className="px-4 py-8 text-center text-sm text-stone-500">No users found.</p>}
      </div>
      {users.hasNextPage && (
        <button type="button" className={`${btn.secondary} self-center`} disabled={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
          {users.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function Templates() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "templates"], queryFn: () => api.get<TemplateSettingDto[]>("/admin/templates") });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTemplateSettingDto }) => api.patch<TemplateSettingDto>(`/admin/templates/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "templates"] });
      void qc.invalidateQueries({ queryKey: keys.templateSettings });
    },
  });
  const byId = new Map((settings.data ?? []).map((s) => [s.templateId, s]));

  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Template</th>
            <th className="px-4 py-3 font-semibold">Published</th>
            <th className="px-4 py-3 font-semibold">Tier</th>
            <th className="px-4 py-3 font-semibold">Order</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {TEMPLATES.map((t) => {
            const s = byId.get(t.id);
            const tier = s?.tier ?? t.tier;
            return (
              <tr key={t.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: t.accent }} />
                    <span className="font-medium text-stone-900">{t.name}</span>
                    <TierBadge tier={tier} />
                  </div>
                  <div className="text-xs text-stone-500">{t.description}</div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Publish ${t.name}`}
                    className="size-4 accent-brand"
                    checked={s?.enabled ?? true}
                    onChange={(e) => update.mutate({ id: t.id, patch: { enabled: e.target.checked } })}
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Tier for ${t.name}`}
                    className="rounded-md border-0 bg-transparent py-1 text-sm ring-1 ring-stone-200"
                    value={s?.tier ?? ""}
                    onChange={(e) => update.mutate({ id: t.id, patch: { tier: (e.target.value || null) as TemplateTier | null } })}
                  >
                    <option value="">Default ({t.tier})</option>
                    {TEMPLATE_TIERS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    aria-label={`Order for ${t.name}`}
                    className="w-20 rounded-md border-0 py-1 text-sm ring-1 ring-stone-200"
                    defaultValue={s?.sortOrder ?? ""}
                    placeholder="—"
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      if (v !== (s?.sortOrder ?? null)) update.mutate({ id: t.id, patch: { sortOrder: v } });
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
