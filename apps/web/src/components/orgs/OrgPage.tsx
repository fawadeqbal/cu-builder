"use client";

import type { OrgDto } from "@cvb/contracts";
import { ROLE_LABEL, orgCan, type OrgAction } from "@cvb/domain";
import { useSearchParams } from "next/navigation";
import { Avatar, BackLink, Card, EmptyState, PageHeader, SideNav, Skeleton, Tabs } from "@cvb/ui";
import { ORG_KIND_LABEL, useOrg } from "@/lib/orgs";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { CandidatesTab } from "./CandidatesTab";
import { CohortTab } from "./CohortTab";
import { MembersTab } from "./MembersTab";
import { SettingsTab } from "./SettingsTab";

type TabId = "overview" | "candidates" | "members" | "settings";
const TABS: { id: TabId; label: (o: OrgDto) => string; icon: string; action: OrgAction; kinds: OrgDto["kind"][] }[] = [
  {
    id: "overview",
    label: () => "Students",
    icon: "graduation-cap",
    action: "cohort.view",
    kinds: ["university", "partner"],
  },
  {
    id: "candidates",
    label: () => "Candidates",
    icon: "briefcase",
    action: "candidates.view",
    kinds: ["agency", "partner"],
  },
  {
    id: "members",
    label: (o) => (o.kind === "agency" ? "Team" : "Members & invites"),
    icon: "users",
    action: "members.view",
    kinds: ["university", "agency", "partner"],
  },
  {
    id: "settings",
    label: () => "Settings",
    icon: "settings",
    action: "org.edit",
    kinds: ["university", "agency", "partner"],
  },
];

/** One organisation: students (universities), candidates (agencies), people and settings. */
export function OrgPage({ id }: { id: string }) {
  return <RequireAuth>{(me) => <Org id={id} siteAdmin={me.role === "admin"} />}</RequireAuth>;
}

function Org({ id, siteAdmin }: { id: string; siteAdmin: boolean }) {
  const org = useOrg(id);
  const params = useSearchParams();
  const o = org.data;
  const tabs = o
    ? TABS.filter((t) => t.kinds.includes(o.kind) && (siteAdmin || (o.role && orgCan(o.role, t.action))))
    : [];
  const tab = tabs.find((t) => t.id === params.get("tab")) ?? tabs[0];
  const can = (a: OrgAction) => siteAdmin || Boolean(o?.role && orgCan(o.role, a));
  const href = (t: TabId) => `/org/${id}?tab=${t}`;

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
        {org.isLoading ? (
          <>
            <BackLink href="/org">Organisations</BackLink>
            <Skeleton width={280} height={34} />
            <Skeleton height={240} shape="block" />
          </>
        ) : !o ? (
          <>
            <BackLink href="/org">Organisations</BackLink>
            <Card>
              <EmptyState icon="building" title="This organisation isn't available">
                <p>This organisation doesn&apos;t exist or you&apos;re not a member.</p>
              </EmptyState>
            </Card>
          </>
        ) : (
          <>
            <PageHeader
              back={{ href: "/org", label: "Organisations" }}
              title={
                <span className="flex min-w-0 items-center gap-3">
                  {o.branding.logoUrl && (
                    <Avatar name={o.name} src={o.branding.logoUrl} shape="square" className="shrink-0" />
                  )}
                  <span className="min-w-0 break-words">{o.name}</span>
                </span>
              }
              description={
                <>
                  {ORG_KIND_LABEL[o.kind]} · {o.role ? ROLE_LABEL[o.role] : "Site admin"} ·{" "}
                  <span className="tabular-nums">{o.seatsUsed}</span> of <span className="tabular-nums">{o.seats}</span>{" "}
                  seats used
                </>
              }
            />
            {tabs.length === 0 ? (
              <Card>
                <p className="text-ink-2">You&apos;re a member of {o.name}. There&apos;s nothing to manage here.</p>
              </Card>
            ) : (
              <>
                <Tabs
                  className="lg:hidden"
                  label={o.name}
                  value={tab?.id}
                  items={tabs.map((t) => ({ id: t.id, label: t.label(o), icon: t.icon, href: href(t.id) }))}
                />
                <div className="flex items-start gap-8">
                  <aside className="sticky top-6 hidden shrink-0 lg:block">
                    <SideNav
                      label="Organisation"
                      groups={[
                        {
                          items: tabs.map((t) => ({
                            href: href(t.id),
                            label: t.label(o),
                            icon: t.icon,
                            current: t.id === tab?.id,
                          })),
                        },
                      ]}
                    />
                  </aside>
                  <div className="flex min-w-0 flex-1 flex-col gap-6">
                    {tab?.id === "overview" && <CohortTab org={o} canExport={can("cohort.export")} />}
                    {tab?.id === "candidates" && <CandidatesTab org={o} canManage={can("candidates.manage")} />}
                    {tab?.id === "members" && (
                      <MembersTab org={o} canManage={can("members.manage")} canInvite={can("invites.send")} />
                    )}
                    {tab?.id === "settings" && <SettingsTab org={o} />}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
