import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPage } from "@/components/admin/AdminPage";

export const metadata: Metadata = { title: "Admin · CV Builder", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AdminPage />
    </Suspense>
  );
}
