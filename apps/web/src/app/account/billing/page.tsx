import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingPage } from "@/components/account/BillingPage";

export const metadata: Metadata = { title: "Plan and billing · CV Builder" };

export default function Page() {
  return (
    <Suspense>
      <BillingPage />
    </Suspense>
  );
}
