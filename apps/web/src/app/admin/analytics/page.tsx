import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsPage } from "@/components/admin/analytics/AnalyticsPage";

export const metadata: Metadata = { title: "Analytics · Admin · CV Builder", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AnalyticsPage />
    </Suspense>
  );
}
