"use client";

import { Tabs } from "@cvb/ui";

export const ADMIN_TABS = ["overview", "analytics", "users", "templates", "organisations", "experts", "pricing", "reviews", "settings"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];
export const ADMIN_TAB_LABEL: Record<AdminTab, string> = {
  overview: "Overview",
  analytics: "Analytics",
  users: "Users",
  templates: "Templates",
  organisations: "Organisations",
  experts: "Experts",
  pricing: "Pricing",
  reviews: "Reviews",
  settings: "Site settings",
};

/**
 * The admin console's sections. Analytics is its own page (/admin/analytics, so reports and
 * filters live in the URL); the rest are tabs of /admin. Pass `onChange` on /admin; elsewhere
 * every tab is a link.
 */
export function AdminTabs({ value, onChange }: { value: AdminTab; onChange?: (tab: Exclude<AdminTab, "analytics">) => void }) {
  return (
    <Tabs
      label="Admin sections"
      value={value}
      onChange={(t) => t !== "analytics" && onChange?.(t)}
      items={ADMIN_TABS.map((t) => ({
        id: t,
        label: ADMIN_TAB_LABEL[t],
        ...(t === "analytics" ? { href: "/admin/analytics" } : onChange ? {} : { href: t === "overview" ? "/admin" : `/admin?tab=${t}` }),
      }))}
    />
  );
}
