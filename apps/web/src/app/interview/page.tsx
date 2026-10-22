import type { Metadata } from "next";
import { Suspense } from "react";
import { InterviewPage } from "@/components/interviews/InterviewPage";

export const metadata: Metadata = { title: "Interview prep · CV Builder" };

export default function Page() {
  return (
    <Suspense>
      <InterviewPage />
    </Suspense>
  );
}
