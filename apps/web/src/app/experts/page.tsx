import type { Metadata } from "next";
import { ExpertsPage } from "@/components/services/ExpertsPage";

export const metadata: Metadata = { title: "Experts · CV Builder", description: "CV reviews, CV writing, coaching and LinkedIn makeovers by vetted experts." };

export default function Page() {
  return <ExpertsPage />;
}
