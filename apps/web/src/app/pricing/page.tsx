import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingPage } from "@/components/billing/PricingPage";

export const metadata: Metadata = {
  title: "Pricing · CV Builder",
  description: "Free to start. Upgrade for more templates, Word exports and share links, or get a Job-Hunt Pass for a week or a month.",
};

export default function Page() {
  return (
    <Suspense>
      <PricingPage />
    </Suspense>
  );
}
