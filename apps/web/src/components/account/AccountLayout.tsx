"use client";

import type { MeDto } from "@cvb/contracts";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Card, PageHeader, SideNav, Tabs } from "@cvb/ui";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";

const TABS = [
  { href: "/account", label: "Profile and security", icon: "user" },
  { href: "/account/billing", label: "Plan and billing", icon: "credit" },
];

/** The Settings template: page header, side navigation (tabs on narrow screens) and stacked cards. */
export function AccountLayout({ title, children }: { title: string; children: (me: MeDto) => ReactNode }) {
  const path = usePathname();
  return (
    <RequireAuth>
      {(me) => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <main className="mx-auto w-full max-w-(--layout-md) px-4 pb-20 pt-10 sm:px-6">
            <PageHeader title={title} />
            <Tabs
              className="mt-4 lg:hidden"
              label={title}
              value={path}
              items={TABS.map((t) => ({ id: t.href, label: t.label, href: t.href, icon: t.icon }))}
            />
            <div className="mt-6 flex items-start gap-8 lg:mt-8">
              <aside className="sticky top-6 hidden shrink-0 lg:block">
                <SideNav label={title} groups={[{ items: TABS.map((t) => ({ ...t, current: path === t.href })) }]} />
              </aside>
              <div className="flex min-w-0 flex-1 flex-col gap-6">{children(me)}</div>
            </div>
          </main>
        </div>
      )}
    </RequireAuth>
  );
}

export function Section({
  title,
  description,
  actions,
  footer,
  id,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Card
      id={id}
      title={title}
      // Nastaliq needs taller lines than the card description's fixed 18px.
      description={description && <span className="block [html[lang=ur]_&]:leading-[1.9]">{description}</span>}
      actions={actions}
      footer={footer}
    >
      {children}
    </Card>
  );
}
