import type { Metadata } from "next";
import { OrgsPage } from "@/components/orgs/OrgsPage";

export const metadata: Metadata = { title: "Organisations · CV Builder" };

export default function Page() {
  return <OrgsPage />;
}
