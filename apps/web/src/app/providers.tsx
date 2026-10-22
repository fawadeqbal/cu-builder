"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { UiProvider, type ThemeChoice, type UiLinkProps } from "@cvb/ui";
import { isApiError } from "@/lib/api";
import { BrandingProvider } from "@/components/branding/BrandingProvider";
import { I18nProvider, useI18n, type Locale } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

/** Design-system components route through Next's <Link> and speak the interface language. */
function DesignSystem({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const labels = useMemo(
    () => ({
      close: t("ui.close"),
      dismiss: t("ui.dismiss"),
      remove: t("common.remove"),
      loading: t("common.loading"),
      optional: t("ui.optional"),
      previousPage: t("ui.previousPage"),
      nextPage: t("ui.nextPage"),
      pages: t("ui.pages"),
      breadcrumb: t("ui.breadcrumb"),
      mainNav: t("ui.mainNav"),
      theme: t("ui.theme"),
      themeLight: t("ui.themeLight"),
      themeDark: t("ui.themeDark"),
      themeSystem: t("ui.themeSystem"),
      language: t("nav.language"),
      chooseFile: t("ui.chooseFile"),
    }),
    [t],
  );
  return (
    <UiProvider link={NextLink} labels={labels}>
      {children}
    </UiProvider>
  );
}

function NextLink({ href, ...rest }: UiLinkProps) {
  return <Link href={href} {...rest} />;
}

/** Client-side providers for every page: server state, theme, interface language, design system, partner branding. */
export function Providers({ children, locale = "en", theme = "system" }: { children: ReactNode; locale?: Locale; theme?: ThemeChoice }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // Don't retry what the server refused on purpose.
            retry: (count, error) => count < 2 && !(isApiError(error) && error.status < 500),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider initial={theme}>
        <I18nProvider initial={locale}>
          <DesignSystem>
            <BrandingProvider>{children}</BrandingProvider>
          </DesignSystem>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
