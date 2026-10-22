import { describe, expect, it } from "vitest";
import { dirOf, fromAcceptLanguage, supportedLocale, translate } from "./core";
import { ar, en, ur } from "./messages";

describe("i18n", () => {
  it("falls back to English for missing keys and fills placeholders", () => {
    expect(translate("ur", "nav.myCvs")).toBe("میری سی ویز");
    expect(translate("ar", "wizard.stepOf", { n: 2, total: 8 })).toBe("الخطوة 2 من 8");
    // A key no dictionary but English has would fall back; simulate with a partial dictionary check.
    const missing = (Object.keys(en) as (keyof typeof en)[]).find((k) => !(k in ur));
    if (missing) expect(translate("ur", missing)).toBe(en[missing]);
  });

  it("maps locale tags and Accept-Language", () => {
    expect(supportedLocale("ur-PK")).toBe("ur");
    expect(supportedLocale("en-GB")).toBe("en");
    expect(supportedLocale("de")).toBeNull();
    expect(fromAcceptLanguage("de-DE,de;q=0.9,ar;q=0.8,en;q=0.7")).toBe("ar");
    expect(fromAcceptLanguage("fr")).toBeNull();
    expect(dirOf("ur")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });

  it("keeps the same placeholders in every translation", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const dict of [ur, ar]) {
      for (const [k, v] of Object.entries(dict)) expect(vars(v!), k).toBe(vars(en[k as keyof typeof en]));
    }
  });
});
