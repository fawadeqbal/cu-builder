"use client";

import type { PublicBrandingDto } from "@cvb/contracts";
import { allowedTemplates, brandStylesheet } from "@cvb/domain";
import { TEMPLATES } from "@cvb/templates/catalog";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Branding = NonNullable<PublicBrandingDto>;

const BrandingContext = createContext<Branding | null>(null);

/** The partner brand for the host the app is opened on, or null on our own domain. */
export const useBranding = () => useContext(BrandingContext);

/** Templates to offer: the partner's chosen set, or all of them. */
export const useAllowedTemplates = () => allowedTemplates(useBranding(), TEMPLATES);

let cached: Promise<Branding | null> | null = null;

function loadBranding(): Promise<Branding | null> {
  cached ??= fetch(`/api/v1/public/branding?host=${encodeURIComponent(window.location.host)}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ branding: PublicBrandingDto }>) : { branding: null }))
    .then((b) => b.branding)
    .catch(() => null);
  return cached;
}

/**
 * White label: on a partner's custom domain, fetches its branding once and applies the brand
 * colour to the design-system tokens (a stylesheet covering light and dark), the product name in
 * the tab title, and the logo as favicon. Mount once, around the app (providers.tsx).
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    let alive = true;
    void loadBranding().then((b) => {
      if (!alive || !b) return;
      setBranding(b);
      const css = brandStylesheet(b);
      if (css) {
        const style = document.getElementById("cvb-brand") ?? document.head.appendChild(Object.assign(document.createElement("style"), { id: "cvb-brand" }));
        style.textContent = css;
      }
      if (b.productName) document.title = document.title.replace(/CV Builder/g, b.productName);
      if (b.logoUrl) {
        const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
        icon.href = b.logoUrl;
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}
