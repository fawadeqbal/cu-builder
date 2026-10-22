"use client";

import type { BrandingDto, OrgBrandingDto } from "@cvb/contracts";
import { brandCssVariables, isHexColor, readableWithWhite } from "@cvb/domain";
import { TEMPLATES } from "@cvb/templates/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { api, isApiError } from "@/lib/api";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { btn, card, field, label } from "../ui/styles";
import { DomainSetup } from "./DomainSetup";

const MAX_LOGO = 100 * 1024;
const key = (orgId: string) => ["orgs", orgId, "branding"] as const;

/** White label for a partner: name, logo, colours, templates offered, and the partner's own domain. */
export function BrandingEditor({ orgId }: { orgId: string }) {
  const data = useQuery({ queryKey: key(orgId), queryFn: () => api.get<OrgBrandingDto>(`/orgs/${orgId}/branding`), retry: false });
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-stone-50">
          <AppHeader />
          <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
            <Link href={`/org/${orgId}`} className="text-sm font-medium text-stone-500 hover:text-stone-800">
              ← Organisation
            </Link>
            {data.isLoading ? (
              <p className="py-16 text-center text-sm text-stone-500">Loading…</p>
            ) : data.data ? (
              <Form key={data.data.orgId} org={data.data} />
            ) : (
              <p className="py-16 text-center text-sm text-stone-600">
                {isApiError(data.error, "FORBIDDEN") ? "Only owners and admins can change branding." : "This organisation isn't available."}
              </p>
            )}
          </main>
        </div>
      )}
    </RequireAuth>
  );
}

function Form({ org }: { org: OrgBrandingDto }) {
  const qc = useQueryClient();
  const [b, setB] = useState<BrandingDto>(org.branding);
  const [logoError, setLogoError] = useState("");
  const save = useMutation({
    mutationFn: () => api.put<OrgBrandingDto>(`/orgs/${org.orgId}/branding`, b),
    onSuccess: (d) => qc.setQueryData(key(org.orgId), d),
  });
  const setOrg = (d: OrgBrandingDto) => qc.setQueryData(key(org.orgId), d);
  const set = <K extends keyof BrandingDto>(k: K, v: BrandingDto[K]) => setB((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(b) !== JSON.stringify(org.branding);
  const lowContrast = isHexColor(b.primaryColor) && !readableWithWhite(b.primaryColor);
  const preview = { ...brandCssVariables(b), "--preview-accent": b.accentColor || b.primaryColor || "#1e4b8f" } as CSSProperties;

  function pickLogo(file: File | undefined) {
    setLogoError("");
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return setLogoError("Use a PNG, JPEG, WebP or SVG image");
    if (file.size > MAX_LOGO) return setLogoError("Use a logo under 100 KB");
    const reader = new FileReader();
    reader.onload = () => set("logoUrl", String(reader.result));
    reader.readAsDataURL(file);
  }

  const color = (k: "primaryColor" | "accentColor", title: string) => (
    <div>
      <label className={label} htmlFor={`b-${k}`}>
        {title}
      </label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${title} picker`} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent" value={isHexColor(b[k]) ? b[k] : "#1e4b8f"} onChange={(e) => set(k, e.target.value)} />
        <input id={`b-${k}`} className={`${field} font-mono`} placeholder="Default" value={b[k]} maxLength={7} onChange={(e) => set(k, e.target.value.trim())} />
      </div>
    </div>
  );

  return (
    <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Branding</h1>
          <p className="text-sm text-stone-500">How the app looks for {org.orgName}&apos;s people on your own domain.</p>
        </div>
        <section className={`${card} grid gap-4 p-5 sm:grid-cols-2`}>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="b-name">
              Product name
            </label>
            <input id="b-name" className={field} maxLength={60} placeholder={`${org.orgName} Careers`} value={b.productName} onChange={(e) => set("productName", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="b-logo">
              Logo (PNG, JPEG, WebP or SVG, under 100 KB)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {b.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- a data: URL or the partner's own link
                <img src={b.logoUrl} alt="Logo" className="h-10 max-w-40 rounded object-contain ring-1 ring-stone-200" />
              )}
              <input id="b-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-sm" onChange={(e) => pickLogo(e.target.files?.[0])} />
              {b.logoUrl && (
                <button type="button" className="text-sm font-medium text-stone-500 hover:underline" onClick={() => set("logoUrl", "")}>
                  Remove
                </button>
              )}
            </div>
            {logoError && <p className="mt-1 text-sm text-red-600">{logoError}</p>}
          </div>
          {color("primaryColor", "Main colour")}
          {color("accentColor", "Accent colour")}
          {lowContrast && (
            <p className="text-sm text-amber-800 sm:col-span-2">White text is hard to read on this main colour. Pick a darker shade so buttons stay readable.</p>
          )}
          <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
            <input type="checkbox" className="size-4 accent-brand" checked={b.hideBrand} onChange={(e) => set("hideBrand", e.target.checked)} /> Hide “CV Builder” mentions
          </label>
        </section>

        <section className={`${card} flex flex-col gap-3 p-5`}>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Templates offered</h2>
            <p className="text-xs text-stone-500">Leave all unticked to offer every template.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={b.templateIds.includes(t.id)}
                  onChange={(e) => set("templateIds", e.target.checked ? [...b.templateIds, t.id] : b.templateIds.filter((x) => x !== t.id))}
                />
                {t.name}
              </label>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
          {save.isSuccess && !dirty && <p className="text-sm text-emerald-700">Saved</p>}
          <button type="button" className={btn.primary} disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save branding"}
          </button>
        </div>

        <section className={`${card} flex flex-col gap-3 p-5`}>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Your domain</h2>
            <p className="text-xs text-stone-500">People who open the app on this domain see your branding.</p>
          </div>
          <DomainSetup
            status={org.customDomain}
            example="careers.your-university.edu"
            onSave={async (domain) => setOrg(await api.put<OrgBrandingDto>(`/orgs/${org.orgId}/branding/domain`, { domain }))}
            onVerify={async () => setOrg(await api.post<OrgBrandingDto>(`/orgs/${org.orgId}/branding/domain/verify`))}
          />
        </section>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className={`${card} overflow-hidden`} style={preview} aria-label="Preview">
          <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
            {b.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview of the uploaded logo
              <img src={b.logoUrl} alt="" className="h-7 max-w-24 object-contain" />
            ) : (
              <span className="grid size-7 place-items-center rounded-md bg-brand text-[10px] font-bold text-white">CV</span>
            )}
            <span className="text-sm font-semibold text-stone-900">{b.productName || (b.hideBrand ? org.orgName : "CV Builder")}</span>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div className="h-2 w-24 rounded-full" style={{ background: "var(--preview-accent)" }} />
            <div className="h-2 w-40 rounded-full bg-stone-200" />
            <div className="h-2 w-32 rounded-full bg-stone-200" />
            <div className="flex gap-2 pt-2">
              <span className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">Create my CV</span>
              <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-stone-200">Sign in</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">Preview of the app header and buttons.</p>
      </aside>
    </div>
  );
}
