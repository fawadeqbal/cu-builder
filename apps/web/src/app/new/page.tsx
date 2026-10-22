import type { Metadata } from "next";
import { WriteCvPage } from "@/components/ai/WriteCvPage";

export const metadata: Metadata = { title: "Write a new CV with AI · CV Builder" };

export default function Page() {
  return <WriteCvPage />;
}
