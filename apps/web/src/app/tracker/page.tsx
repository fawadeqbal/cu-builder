import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackerPage } from "@/components/tracker/TrackerPage";

export const metadata: Metadata = { title: "Applications · CV Builder" };

export default function Page() {
  return (
    <Suspense>
      <TrackerPage />
    </Suspense>
  );
}
