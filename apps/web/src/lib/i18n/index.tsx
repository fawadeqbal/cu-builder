"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { keys, useMe } from "../queries";
import { dirOf, LOCALE_COOKIE, supportedLocale, translate, type Locale, type MessageKey, type Vars } from "./core";

export { LOCALES, dirOf, supportedLocale, type Locale, type MessageKey } from "./core";

type I18n = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (key: MessageKey, vars?: Vars) => string;
  /** Switches the interface language; remembered in a cookie and, when signed in, on the account. */
  setLocale: (locale: Locale) => void;
};

const Ctx = createContext<I18n>({
  locale: "en",
  dir: "ltr",
  t: (key, vars) => translate("en", key, vars),
  setLocale: () => {},
});

function apply(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
}

/**
 * The interface language. The server picks the first one (cookie, else Accept-Language) so the
 * page renders in the right language and direction without a flash; a signed-in user's saved
 * language wins once the session is known.
 */
export function I18nProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const [locale, setState] = useState<Locale>(initial);
  const me = useMe();
  const qc = useQueryClient();
  const saved = supportedLocale(me.data?.locale);

  // Adopt the account's language when it differs (e.g. chosen on another device).
  const [adopted, setAdopted] = useState<string | null>(null);
  if (me.data && saved && saved !== locale && adopted !== me.data.id) {
    setAdopted(me.data.id);
    setState(saved);
  }
  useEffect(() => apply(locale), [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setState(next);
      apply(next);
      if (me.data && supportedLocale(me.data.locale) !== next) {
        void api.patch("/me", { locale: next }).then(() => qc.invalidateQueries({ queryKey: keys.me }));
      }
    },
    [me.data, qc],
  );

  const value = useMemo<I18n>(() => ({ locale, dir: dirOf(locale), t: (key, vars) => translate(locale, key, vars), setLocale }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
/** `const t = useT(); t("nav.myCvs")` */
export const useT = () => useContext(Ctx).t;
