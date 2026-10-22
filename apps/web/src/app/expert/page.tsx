import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpertWorkspace } from "@/components/services/ExpertWorkspace";

export const metadata: Metadata = { title: "Expert workspace · CV Builder" };

export default function Page() {
  return (
    <Suspense>
      <ExpertWorkspace />
    </Suspense>
  );
}
