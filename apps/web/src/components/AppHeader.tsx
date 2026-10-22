"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar, Avatar, Button, Drawer, Dropdown, IconButton, LanguageSwitcher as DsLanguageSwitcher, SideNav, ThemeToggle, type MenuItem } from "@cvb/ui";
import { authClient } from "@/lib/auth-client";
import { PLAN_LABEL } from "@/lib/plans";
import { LOCALES, useI18n, type MessageKey } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import { useTheme } from "@/lib/theme";
import { useBranding } from "./branding/BrandingProvider";

const NAV: { href: string; label: MessageKey; auth: boolean; icon: string }[] = [
  { href: "/app", label: "nav.myCvs", auth: true, icon: "files" },
  { href: "/jobs", label: "nav.jobs", auth: true, icon: "briefcase" },
  { href: "/tracker", label: "nav.tracker", auth: true, icon: "kanban" },
  { href: "/interview", label: "nav.interview", auth: true, icon: "mic" },
  { href: "/experts", label: "nav.experts", auth: false, icon: "users" },
  { href: "/letters", label: "nav.letters", auth: true, icon: "mail" },
  { href: "/templates", label: "nav.templates", auth: false, icon: "template" },
  { href: "/pricing", label: "nav.pricing", auth: false, icon: "credit" },
];

const isCurrent = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * The global app bar (design system AppBar): the blue band with the product, main navigation,
 * language, theme and the account menu. Below 768px the links move into a menu drawer.
 */
export function AppHeader() {
  const me = useMe();
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const user = me.data;
  const { t } = useI18n();
  const { choice, setChoice } = useTheme();
  const branding = useBranding();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await authClient.signOut();
    qc.clear();
    router.replace("/");
  }

  const links = NAV.filter((n) => !n.auth || user).map((n) => ({ href: n.href, label: t(n.label), icon: n.icon, current: isCurrent(path, n.href) }));
  if (user?.role === "admin") links.push({ href: "/admin", label: t("nav.admin"), icon: "settings", current: path.startsWith("/admin") });

  const accountItems: MenuItem[] = user
    ? [
        { heading: `${user.name || user.email} · ${t("nav.planBadge", { plan: PLAN_LABEL[user.plan] })}` },
        { label: t("nav.account"), icon: "user", href: "/account" },
        { label: t("nav.billing"), icon: "credit", href: "/account/billing" },
        { label: t("nav.orders"), icon: "list", href: "/orders" },
        { label: t("nav.website"), icon: "globe", href: "/website" },
        { label: t("nav.orgs"), icon: "building", href: "/org" },
        { label: t("nav.expert"), icon: "award", href: "/expert" },
        "separator",
        { label: t("nav.signOut"), icon: "logout", onSelect: () => void signOut() },
      ]
    : [];

  return (
    <>
      <AppBar
        product={branding?.productName || "CV Builder"}
        logoSrc={branding?.logoUrl || null}
        logoHref={user ? "/app" : "/"}
        links={links}
        start={
          <span className="md:hidden">
            <IconButton icon="menu" label={t("ui.menu")} tooltip={false} onClick={() => setMenuOpen(true)} />
          </span>
        }
        end={
          <>
            <span className="hidden sm:inline-flex">
              <LanguageSwitcher />
            </span>
            <span className="hidden lg:inline-flex">
              <ThemeToggle value={choice} onChange={setChoice} />
            </span>
            {me.isLoading ? null : user ? (
              <>
                {user.plan === "free" && (
                  <span className="hidden sm:inline-flex">
                    <Button size="sm" variant="highlight" icon="sparkle" href="/pricing">
                      {t("nav.upgrade")}
                    </Button>
                  </span>
                )}
                <Dropdown
                  label={t("ui.account")}
                  items={accountItems}
                  trigger={(p) => (
                    <button type="button" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-haspopup="menu" aria-label={t("ui.account")} className="cvb-account-trigger">
                      <Avatar name={user.name || user.email} src={user.image ?? undefined} />
                    </button>
                  )}
                />
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" href={`/sign-in?next=${encodeURIComponent(path)}`}>
                  {t("nav.signIn")}
                </Button>
                {path !== "/" && (
                  <span className="hidden sm:inline-flex">
                    <Button size="sm" variant="primary" href="/">
                      {t("nav.build")}
                    </Button>
                  </span>
                )}
              </>
            )}
          </>
        }
      />
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={branding?.productName || "CV Builder"}>
        <div onClick={(e) => (e.target as HTMLElement).closest("a") && setMenuOpen(false)}>
          <SideNav label={t("ui.mainNav")} groups={[{ items: links }]} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <LanguageSwitcher />
          <ThemeToggle value={choice} onChange={setChoice} size="md" />
        </div>
      </Drawer>
    </>
  );
}

/** The interface language: English, اردو, العربية. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <span className={className}>
      <DsLanguageSwitcher value={locale} onChange={setLocale} options={LOCALES.map((l) => ({ value: l.code, label: l.label }))} />
    </span>
  );
}
