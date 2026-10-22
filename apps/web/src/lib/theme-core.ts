import type { ThemeChoice } from "@cvb/ui";

export const THEME_COOKIE = "cvb-theme";

/** "light" | "dark" | "system" from a cookie value; anything else is "system". */
export function themeChoice(v: string | null | undefined): ThemeChoice {
  return v === "light" || v === "dark" ? v : "system";
}
