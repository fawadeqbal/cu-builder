import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic, Instrument_Sans, Inter, JetBrains_Mono, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu, Schibsted_Grotesk, Source_Serif_4 } from "next/font/google";
import { cookies, headers } from "next/headers";
import { dirOf, fromAcceptLanguage, LOCALE_COOKIE, supportedLocale } from "@/lib/i18n/core";
import { siteUrl, SITE_NAME } from "@/lib/seo";
import { THEME_COOKIE, themeChoice } from "@/lib/theme-core";
import "./globals.css";
import "@cvb/templates/styles.css";
import { Providers } from "./providers";

// Interface type (design system "Folio"): Schibsted Grotesk for titles and numbers, Instrument Sans
// for everything else, IBM Plex Mono for figures and IDs, IBM Plex Sans Arabic and Noto Nastaliq
// Urdu for right-to-left. tokens.css builds the stacks from these variables.
const display = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const sans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

// CV templates: Inter, Source Serif and JetBrains Mono (the printed sheet keeps its own type).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const mono = JetBrains_Mono({
  variable: "--font-cv-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

// Urdu and Arabic CVs (Naskh), and Urdu for both the interface and CVs (Nastaliq).
const naskh = Noto_Naskh_Arabic({
  variable: "--font-rtl",
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  preload: false,
});

const nastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq",
  subsets: ["arabic"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  // Absolute URLs for canonical links and share images come from APP_URL (see lib/seo.ts).
  metadataBase: new URL(siteUrl()),
  title: "CV Builder",
  description: "Write your CV once, pick a template and download a clean PDF or Word file.",
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en" },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The language is decided on the server (cookie, else the browser's languages) so pages render
  // in the right language and direction straight away.
  const jar = await cookies();
  const locale = supportedLocale(jar.get(LOCALE_COOKIE)?.value) ?? fromAcceptLanguage((await headers()).get("accept-language")) ?? "en";
  // Light or dark from the cookie; without one, tokens.css follows the system setting.
  const theme = themeChoice(jar.get(THEME_COOKIE)?.value);
  const fonts = [display, sans, plexMono, plexArabic, inter, serif, mono, naskh, nastaliq].map((f) => f.variable).join(" ");
  return (
    <html lang={locale} dir={dirOf(locale)} data-theme={theme === "system" ? undefined : theme} className={`${fonts} antialiased`} suppressHydrationWarning>
      <body>
        <Providers locale={locale} theme={theme}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
