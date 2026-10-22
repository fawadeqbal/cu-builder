import type { Metadata } from "next";
import { AccountPage } from "@/components/account/AccountPage";

export const metadata: Metadata = { title: "Account · CV Builder" };

export default function Page() {
  return <AccountPage />;
}
