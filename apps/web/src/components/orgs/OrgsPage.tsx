"use client";

import type { OrgDto } from "@cvb/contracts";
import { ROLE_LABEL } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { PlusIcon } from "@cvb/ui";
import { api } from "@/lib/api";
import { ORG_KIND_LABEL, orgKeys, useMyOrgs } from "@/lib/orgs";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { btn, card, field, label } from "../ui/styles";

function Shell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-stone-50">
          <AppHeader />
          <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6">{children}</main>
        </div>
      )}
    </RequireAuth>
  );
}

/** Organisations you belong to: universities, career centres, agencies. */
export function OrgsPage() {
  return (
    <Shell>
      <OrgList />
    </Shell>
  );
}

function OrgList() {
  const orgs = useMyOrgs();
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-stone-900">Organisations</h1>
        <Link href="/org/new" className={btn.primary}>
          <PlusIcon className="size-4" /> New organisation
        </Link>
      </div>
      <p className="mt-1 text-sm text-stone-500">Career centres follow their students&apos; progress; agencies format candidate CVs in their own template.</p>
      {orgs.isLoading ? (
        <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
      ) : !orgs.data?.length ? (
        <div className={`${card} mt-6 px-6 py-12 text-center text-sm text-stone-600`}>
          You&apos;re not part of an organisation yet. If your university or employer sent you a link, open it to join.
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {orgs.data.map((o) => (
            <li key={o.id}>
              <OrgCard org={o} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function OrgCard({ org }: { org: OrgDto }) {
  const staff = org.role && org.role !== "member";
  const body = (
    <>
      <div className="flex items-center gap-3">
        {org.branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied logo (data: or https)
          <img src={org.branding.logoUrl} alt="" className="size-10 rounded-lg object-contain ring-1 ring-stone-200" />
        ) : (
          <span className="grid size-10 place-items-center rounded-lg bg-stone-900 text-sm font-semibold uppercase text-white">{org.name.slice(0, 2)}</span>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold text-stone-900">{org.name}</div>
          <div className="text-xs text-stone-500">
            {ORG_KIND_LABEL[org.kind]} · {org.role ? ROLE_LABEL[org.role] : "Site admin"}
          </div>
        </div>
      </div>
      {org.role === "member" && org.seatsUsed > 0 && <p className="mt-3 text-xs text-emerald-700">Your {org.seatPlan} access comes from this organisation.</p>}
    </>
  );
  return staff ? (
    <Link href={`/org/${org.id}`} className={`${card} block p-4 transition hover:border-stone-300`}>
      {body}
    </Link>
  ) : (
    <div className={`${card} p-4`}>{body}</div>
  );
}

export function NewOrgPage() {
  return (
    <Shell>
      <NewOrgForm />
    </Shell>
  );
}

function NewOrgForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OrgDto["kind"]>("university");
  const create = useMutation({
    mutationFn: () => api.post<OrgDto>("/orgs", { name: name.trim(), kind }),
    onSuccess: (org) => {
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
      router.push(`/org/${org.id}`);
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  return (
    <form onSubmit={submit} className={`${card} mx-auto flex max-w-lg flex-col gap-4 p-6`}>
      <h1 className="text-xl font-semibold text-stone-900">New organisation</h1>
      <div>
        <label className={label} htmlFor="org-name">
          Name
        </label>
        <input id="org-name" required minLength={2} maxLength={120} className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FAST Career Services" />
      </div>
      <fieldset>
        <legend className={label}>Type</legend>
        <div className="flex flex-col gap-2">
          {(["university", "agency"] as const).map((k) => (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${kind === k ? "bg-brand/[0.04] ring-brand/40" : "ring-stone-200"}`}>
              <input type="radio" name="kind" className="mt-1 accent-brand" checked={kind === k} onChange={() => setKind(k)} />
              <span>
                <span className="block text-sm font-semibold text-stone-900">{ORG_KIND_LABEL[k]}</span>
                <span className="block text-xs text-stone-500">
                  {k === "university"
                    ? "Invite students, see who has a CV, their ATS scores and applications, and comment on their CVs."
                    : "Upload candidate CVs in bulk, check what the reader wasn't sure of, and export them in your template."}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-stone-500">Seat licences for students are added by our team after you&apos;ve talked to us.</p>
      {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
      <button type="submit" className={btn.primary} disabled={create.isPending || name.trim().length < 2}>
        {create.isPending ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
