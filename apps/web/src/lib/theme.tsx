"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ThemeChoice } from "@cvb/ui";
import { THEME_COOKIE } from "./theme-core";

export { THEME_COOKIE, themeChoice } from "./theme-core";

type Theme = { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void };
const Ctx = createContext<Theme>({ choice: "system", setChoice: () => {} });

/**
 * Light, dark or follow the system. The server renders `data-theme` from the cookie so there is no
 * flash; "system" leaves the attribute off and tokens.css follows prefers-color-scheme.
 */
export function ThemeProvider({ initial, children }: { initial: ThemeChoice; children: ReactNode }) {
  const [choice, setState] = useState<ThemeChoice>(initial);
  const setChoice = useCallback((c: ThemeChoice) => {
    setState(c);
    document.cookie = `${THEME_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`;
    const root = document.documentElement;
    if (c === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", c);
  }, []);
  const value = useMemo(() => ({ choice, setChoice }), [choice, setChoice]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
