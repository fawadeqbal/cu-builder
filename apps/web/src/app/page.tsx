import type { Metadata } from "next";
import { Suspense } from "react";
import { LandingPage } from "@/components/landing/LandingPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { landingEn } from "@/lib/i18n/landing";
import { landingJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "CV Builder · Build an ATS-friendly CV that gets interviews",
  description:
    "Write your CV step by step with a live preview, an ATS check and honest AI help. Import your old CV, tailor it to each job and download a free PDF. English, Urdu and Arabic.",
};

// The same questions the page shows (FAQ structured data must match visible text).
const FAQ = ([1, 2, 3, 4, 5, 6, 7] as const).map((n) => ({ q: landingEn[`landing.faq.q${n}`], a: landingEn[`landing.faq.a${n}`] }));

export default function Home() {
  return (
    <>
      <JsonLd data={landingJsonLd(FAQ)} />
      <Suspense>
        <LandingPage />
      </Suspense>
    </>
  );
}
