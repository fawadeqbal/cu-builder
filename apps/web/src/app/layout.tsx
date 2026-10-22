import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu, Source_Serif_4 } from "next/font/google";
import { cookies, headers } from "next/headers";
import { dirOf, fromAcceptLanguage, LOCALE_COOKIE, supportedLocale } from "@/lib/i18n/core";
import "./globals.css";
import "@cvb/templates/styles.css";
import { Providers } from "./providers";

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
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

// Urdu and Arabic: used by the interface in those languages and by right-to-left CVs.
const naskh = Noto_Naskh_Arabic({
  variable: "--font-rtl",
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  preload: false,
});

const nastaliq = Noto_Nastaliq_Urdu({
  variable: "--font-urdu",
  subsets: ["arabic"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "CV Builder",
  description: "Write your CV once, pick a template and download a clean PDF or Word file.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The language is decided on the server (cookie, else the browser's languages) so pages render
  // in the right language and direction straight away.
  const locale = supportedLocale((await cookies()).get(LOCALE_COOKIE)?.value) ?? fromAcceptLanguage((await headers()).get("accept-language")) ?? "en";
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${inter.variable} ${serif.variable} ${mono.variable} ${naskh.variable} ${nastaliq.variable} antialiased`}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
