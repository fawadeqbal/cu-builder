"use client";

import type { MeDto } from "@cvb/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";

const TABS = [
  { href: "/account", label: "Profile and security" },
  { href: "/account/billing", label: "Plan and billing" },
];

export function AccountLayout({ title, children }: { title: string; children: (me: MeDto) => ReactNode }) {
  const path = usePathname();
  return (
    <RequireAuth>
      {(me) => (
        <div className="min-h-dvh bg-stone-50">
          <AppHeader />
          <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
            <nav className="mt-4 flex gap-1 border-b border-stone-200 text-sm font-medium">
              {TABS.map((t) => (
                <Link key={t.href} href={t.href} className={`-mb-px border-b-2 px-3 py-2 ${path === t.href ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 flex flex-col gap-6">{children(me)}</div>
          </main>
        </div>
      )}
    </RequireAuth>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
