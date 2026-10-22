"use client";

import type { OrgDto } from "@cvb/contracts";
import { TEMPLATES } from "@cvb/templates/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { orgKeys } from "@/lib/orgs";
import { PLAN_LABEL } from "@/lib/plans";
import { btn, card, field, label } from "../ui/styles";

const MAX_LOGO = 200_000;

/** Name, sign-in domains, agency branding, seats. */
export function SettingsTab({ org }: { org: OrgDto }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [domains, setDomains] = useState(org.ssoDomains.join(", "));
  const [template, setTemplate] = useState(org.defaultTemplateId ?? "");
  const [brandName, setBrandName] = useState(org.branding.productName ?? "");
  const [logo, setLogo] = useState(org.branding.logoUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api.patch<OrgDto>(`/orgs/${org.id}`, {
        name: name.trim(),
        ssoDomains: domains.split(/[\s,;]+/).filter(Boolean),
        ...(org.kind !== "university" ? { defaultTemplateId: template || null, brandName: brandName.trim(), brandLogoUrl: logo } : {}),
      }),
    onSuccess: (o) => {
      qc.setQueryData(orgKeys.org(org.id), o);
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
      setDomains(o.ssoDomains.join(", "));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/orgs/${org.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
      router.replace("/org");
    },
  });

  async function pickLogo(file: File | undefined) {
    setLogoError("");
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return setLogoError("Use a PNG, JPEG, WebP or SVG image.");
    if (file.size > MAX_LOGO) return setLogoError("Keep the logo under 200 KB.");
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href={`/org/${org.id}/branding`} className={`${card} flex items-center justify-between gap-3 p-4 text-sm hover:border-stone-300`}>
        <span>
          <span className="block font-semibold text-stone-900">White label</span>
          <span className="text-stone-600">Your logo, colours, templates and your own domain.</span>
        </span>
        <span aria-hidden className="text-brand rtl:-scale-x-100">→</span>
      </Link>
      <form onSubmit={submit} className={`${card} flex flex-col gap-4 p-5`}>
        <div>
          <label className={label} htmlFor="s-name">
            Name
          </label>
          <input id="s-name" className={field} value={name} minLength={2} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="s-domains">
            Email domains for single sign-on
          </label>
          <input id="s-domains" className={field} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="uni.edu.pk, students.uni.edu.pk" />
          <p className="mt-1 text-xs text-stone-500">People who sign in with Google or Microsoft using one of these domains join as {org.kind === "agency" ? "members" : "students"} while seats last.</p>
        </div>
        {org.kind !== "university" && (
          <>
            <div>
              <label className={label} htmlFor="s-template">
                Template for candidate CVs
              </label>
              <select id="s-template" className={field} value={template} onChange={(e) => setTemplate(e.target.value)}>
                <option value="">Classic</option>
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="s-brand">
                Name shown above candidate CVs
              </label>
              <input id="s-brand" className={field} value={brandName} maxLength={80} onChange={(e) => setBrandName(e.target.value)} placeholder={org.name} />
            </div>
            <div>
              <span className={label}>Logo</span>
              <div className="flex items-center gap-3">
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element -- preview of the uploaded logo
                  <img src={logo} alt="Logo preview" className="h-10 max-w-32 rounded object-contain ring-1 ring-stone-200" />
                )}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Logo file" className="text-sm" onChange={(e) => void pickLogo(e.target.files?.[0])} />
                {logo && (
                  <button type="button" className="text-sm font-medium text-red-600 hover:underline" onClick={() => setLogo("")}>
                    Remove
                  </button>
                )}
              </div>
              {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
            </div>
          </>
        )}
        {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className={btn.primary} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-sm text-emerald-700">Saved</span>}
        </div>
      </form>

      <section className={`${card} p-5 text-sm text-stone-700`}>
        <h2 className="text-base font-semibold text-stone-900">Seats</h2>
        <p className="mt-1">
          {org.seatsUsed} of {org.seats} seats used. Each seat gives a {org.kind === "agency" ? "recruiter" : "student"} the {PLAN_LABEL[org.seatPlan]} plan while they belong to {org.name}.
        </p>
        <p className="mt-1 text-xs text-stone-500">To add seats, contact us; staff (owners, admins, reviewers) don&apos;t use seats.</p>
      </section>

      {org.role === "owner" && (
        <section className={`${card} flex items-center justify-between gap-3 p-5`}>
          <div>
            <h2 className="text-base font-semibold text-stone-900">Delete organisation</h2>
            <p className="text-sm text-stone-500">Members keep their own accounts and CVs.</p>
          </div>
          <button type="button" className={btn.danger} onClick={() => window.confirm(`Delete ${org.name}?`) && remove.mutate()}>
            Delete
          </button>
        </section>
      )}
    </div>
  );
}
