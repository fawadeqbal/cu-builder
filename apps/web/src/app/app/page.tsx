import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPage } from "@/components/dashboard/DashboardPage";

export const metadata: Metadata = { title: "My CVs · CV Builder" };

export default function Page() {
  return (
    <Suspense>
      <DashboardPage />
    </Suspense>
  );
}
