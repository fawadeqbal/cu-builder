import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsPage } from "@/components/jobs/JobsPage";

export const metadata: Metadata = { title: "Jobs · CV Builder" };

export default function Page() {
  return (
    <Suspense>
      <JobsPage />
    </Suspense>
  );
}
