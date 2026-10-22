import type { Metadata } from "next";
import { NewOrgPage } from "@/components/orgs/OrgsPage";

export const metadata: Metadata = { title: "New organisation · CV Builder" };

export default function Page() {
  return <NewOrgPage />;
}
