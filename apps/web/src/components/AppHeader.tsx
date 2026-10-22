"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { ChevronDownIcon, LogoutIcon } from "@cvb/ui";
import { authClient } from "@/lib/auth-client";
import { PLAN_LABEL } from "@/lib/plans";
import { useMe } from "@/lib/queries";

const NAV = [
  { href: "/app", label: "My CVs", auth: true },
  { href: "/jobs", label: "Jobs", auth: true },
  { href: "/letters", label: "Letters", auth: true },
  { href: "/templates", label: "Templates", auth: false },
  { href: "/pricing", label: "Pricing", auth: false },
];

/** Top bar for the account pages: navigation, plan and the account menu. */
export function AppHeader() {
  const me = useMe();
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const menu = useRef<HTMLDetailsElement>(null);
  const user = me.data;

  async function signOut() {
    await authClient.signOut();
    qc.clear();
    router.replace("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href={user ? "/app" : "/"} className="mr-1 flex shrink-0 items-center gap-2.5 sm:mr-3">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-[11px] font-bold tracking-wide text-white shadow-sm shadow-brand/30">CV</span>
          <span className="hidden text-sm font-semibold text-stone-900 sm:inline">CV Builder</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm font-medium">
          {NAV.filter((n) => !n.auth || user).map((n) => {
            const on = path === n.href || (n.href !== "/app" && path.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-lg px-2.5 py-2 transition sm:px-3 ${on ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"}`}>
                {n.label}
              </Link>
            );
          })}
          {user?.role === "admin" && (
            <Link href="/admin" className={`whitespace-nowrap rounded-lg px-2.5 py-2 transition sm:px-3 ${path.startsWith("/admin") ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50"}`}>
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {me.isLoading ? null : user ? (
            <>
              {user.plan === "free" && (
                <Link href="/pricing" className="hidden rounded-lg bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/15 sm:block">
                  Upgrade
                </Link>
              )}
              <details ref={menu} className="relative [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-stone-100">
                  <span className="grid size-8 place-items-center rounded-full bg-stone-900 text-xs font-semibold uppercase text-white">
                    {(user.name || user.email).slice(0, 1)}
                  </span>
                  <ChevronDownIcon className="size-3.5 text-stone-400" />
                </summary>
                <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-xl" onClick={() => menu.current?.removeAttribute("open")}>
                  <div className="px-3 py-2">
                    <div className="truncate text-sm font-semibold text-stone-900">{user.name}</div>
                    <div className="truncate text-xs text-stone-500">{user.email}</div>
                    <div className="mt-1.5 inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">{PLAN_LABEL[user.plan]} plan</div>
                  </div>
                  <div className="mx-2 my-1 border-t border-stone-100" />
                  <Link href="/account" className="block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100">
                    Account settings
                  </Link>
                  <Link href="/account/billing" className="block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100">
                    Plan and billing
                  </Link>
                  <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100">
                    <LogoutIcon className="size-4" /> Sign out
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href={`/sign-in?next=${encodeURIComponent(path)}`} className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
                Sign in
              </Link>
              <Link href="/" className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark">
                Build a CV
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
