import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/AdminPage";

export const metadata: Metadata = { title: "Admin · CV Builder", robots: { index: false } };

export default function Page() {
  return <AdminPage />;
}
