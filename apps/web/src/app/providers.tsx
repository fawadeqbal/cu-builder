"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { isApiError } from "@/lib/api";
import { BrandingProvider } from "@/components/branding/BrandingProvider";
import { I18nProvider, type Locale } from "@/lib/i18n";

/** Client-side providers for every page: server state (TanStack Query), interface language, partner branding. */
export function Providers({ children, locale = "en" }: { children: ReactNode; locale?: Locale }) {
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
      <I18nProvider initial={locale}>
        <BrandingProvider>{children}</BrandingProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
