"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { ChevronDownIcon, LogoutIcon } from "@cvb/ui";
import { authClient } from "@/lib/auth-client";
import { PLAN_LABEL } from "@/lib/plans";
import { LOCALES, useI18n, type MessageKey } from "@/lib/i18n";
import { useMe } from "@/lib/queries";

const NAV: { href: string; label: MessageKey; auth: boolean }[] = [
  { href: "/app", label: "nav.myCvs", auth: true },
  { href: "/jobs", label: "nav.jobs", auth: true },
  { href: "/tracker", label: "nav.tracker", auth: true },
  { href: "/interview", label: "nav.interview", auth: true },
  { href: "/experts", label: "nav.experts", auth: false },
  { href: "/letters", label: "nav.letters", auth: true },
  { href: "/templates", label: "nav.templates", auth: false },
  { href: "/pricing", label: "nav.pricing", auth: false },
];

/** Top bar for the account pages: navigation, plan and the account menu. */
export function AppHeader() {
  const me = useMe();
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const menu = useRef<HTMLDetailsElement>(null);
  const user = me.data;
  const { t } = useI18n();

  async function signOut() {
    await authClient.signOut();
    qc.clear();
    router.replace("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href={user ? "/app" : "/"} className="me-1 flex shrink-0 items-center gap-2.5 sm:me-3">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-[11px] font-bold tracking-wide text-white shadow-sm shadow-brand/30">CV</span>
          <span className="hidden text-sm font-semibold text-stone-900 sm:inline">CV Builder</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm font-medium">
          {NAV.filter((n) => !n.auth || user).map((n) => {
            const on = path === n.href || (n.href !== "/app" && path.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-lg px-2.5 py-2 transition sm:px-3 ${on ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"}`}>
                {t(n.label)}
              </Link>
            );
          })}
          {user?.role === "admin" && (
            <Link href="/admin" className={`whitespace-nowrap rounded-lg px-2.5 py-2 transition sm:px-3 ${path.startsWith("/admin") ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50"}`}>
              {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          {me.isLoading ? null : user ? (
            <>
              {user.plan === "free" && (
                <Link href="/pricing" className="hidden rounded-lg bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/15 sm:block">
                  {t("nav.upgrade")}
                </Link>
              )}
              <details ref={menu} className="relative [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 ps-1 pe-2 hover:bg-stone-100">
                  <span className="grid size-8 place-items-center rounded-full bg-stone-900 text-xs font-semibold uppercase text-white">
                    {(user.name || user.email).slice(0, 1)}
                  </span>
                  <ChevronDownIcon className="size-3.5 text-stone-400" />
                </summary>
                <div className="absolute end-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-xl" onClick={() => menu.current?.removeAttribute("open")}>
                  <div className="px-3 py-2">
                    <div className="truncate text-sm font-semibold text-stone-900">{user.name}</div>
                    <div className="truncate text-xs text-stone-500">{user.email}</div>
                    <div className="mt-1.5 inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">{t("nav.planBadge", { plan: PLAN_LABEL[user.plan] })}</div>
                  </div>
                  <div className="mx-2 my-1 border-t border-stone-100" />
                  <Link href="/account" className="block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100">
                    {t("nav.account")}
                  </Link>
                  <Link href="/account/billing" className="block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100">
                    {t("nav.billing")}
                  </Link>
                  <Link href="/orders" className="block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100">
                    {t("nav.orders")}
                  </Link>
                  <Link href="/website" className="block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100">
                    {t("nav.website")}
                  </Link>
                  <Link href="/org" className="block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100">
                    {t("nav.orgs")}
                  </Link>
                  <Link href="/expert" className="block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100">
                    {t("nav.expert")}
                  </Link>
                  <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-stone-700 hover:bg-stone-100">
                    <LogoutIcon className="size-4" /> {t("nav.signOut")}
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href={`/sign-in?next=${encodeURIComponent(path)}`} className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
                {t("nav.signIn")}
              </Link>
              <Link href="/" className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark">
                {t("nav.build")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** The interface language: English, اردو, العربية. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={`relative ${className}`}>
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number]["code"])}
        className="cursor-pointer appearance-none rounded-lg bg-transparent py-1.5 ps-2 pe-6 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute end-1.5 top-1/2 size-3 -translate-y-1/2 text-stone-400" />
    </label>
  );
}

