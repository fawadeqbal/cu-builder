"use client";

import type { OrgDto } from "@cvb/contracts";
import { ROLE_LABEL, orgCan, type OrgAction } from "@cvb/domain";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "@cvb/ui";
import { ORG_KIND_LABEL, useOrg } from "@/lib/orgs";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { CandidatesTab } from "./CandidatesTab";
import { CohortTab } from "./CohortTab";
import { MembersTab } from "./MembersTab";
import { SettingsTab } from "./SettingsTab";

type TabId = "overview" | "candidates" | "members" | "settings";
const TABS: { id: TabId; label: (o: OrgDto) => string; action: OrgAction; kinds: OrgDto["kind"][] }[] = [
  { id: "overview", label: () => "Students", action: "cohort.view", kinds: ["university", "partner"] },
  { id: "candidates", label: () => "Candidates", action: "candidates.view", kinds: ["agency", "partner"] },
  { id: "members", label: (o) => (o.kind === "agency" ? "Team" : "Members & invites"), action: "members.view", kinds: ["university", "agency", "partner"] },
  { id: "settings", label: () => "Settings", action: "org.edit", kinds: ["university", "agency", "partner"] },
];

/** One organisation: students (universities), candidates (agencies), people and settings. */
export function OrgPage({ id }: { id: string }) {
  return <RequireAuth>{(me) => <Org id={id} siteAdmin={me.role === "admin"} />}</RequireAuth>;
}

function Org({ id, siteAdmin }: { id: string; siteAdmin: boolean }) {
  const org = useOrg(id);
  const params = useSearchParams();
  const router = useRouter();
  const o = org.data;
  const tabs = o ? TABS.filter((t) => t.kinds.includes(o.kind) && (siteAdmin || (o.role && orgCan(o.role, t.action)))) : [];
  const tab = tabs.find((t) => t.id === params.get("tab")) ?? tabs[0];
  const can = (a: OrgAction) => siteAdmin || Boolean(o?.role && orgCan(o.role, a));

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/org" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeftIcon className="size-4 rtl:rotate-180" /> Organisations
        </Link>
        {org.isLoading ? (
          <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
        ) : !o ? (
          <p className="py-10 text-center text-sm text-stone-600">This organisation doesn&apos;t exist or you&apos;re not a member.</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {o.branding.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- user-supplied logo
                <img src={o.branding.logoUrl} alt="" className="size-11 rounded-lg object-contain ring-1 ring-stone-200" />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-stone-900">{o.name}</h1>
                <p className="text-sm text-stone-500">
                  {ORG_KIND_LABEL[o.kind]} · {o.role ? ROLE_LABEL[o.role] : "Site admin"} · {o.seatsUsed} of {o.seats} seats used
                </p>
              </div>
            </div>
            {tabs.length === 0 ? (
              <p className="mt-8 text-sm text-stone-600">You&apos;re a member of {o.name}. There&apos;s nothing to manage here.</p>
            ) : (
              <>
                <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-stone-200 text-sm font-medium">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-current={t.id === tab?.id ? "page" : undefined}
                      onClick={() => router.replace(`/org/${o.id}?tab=${t.id}`, { scroll: false })}
                      className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${t.id === tab?.id ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
                    >
                      {t.label(o)}
                    </button>
                  ))}
                </nav>
                <div className="mt-6">
                  {tab?.id === "overview" && <CohortTab org={o} canExport={can("cohort.export")} />}
                  {tab?.id === "candidates" && <CandidatesTab org={o} canManage={can("candidates.manage")} />}
                  {tab?.id === "members" && <MembersTab org={o} canManage={can("members.manage")} canInvite={can("invites.send")} />}
                  {tab?.id === "settings" && <SettingsTab org={o} />}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
