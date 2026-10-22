import type { Metadata } from "next";
import { WriteReviewPage } from "@/components/trust/WriteReviewPage";

export const metadata: Metadata = { title: "Write a review · CV Builder", robots: { index: false } };

export default function Page() {
  return <WriteReviewPage />;
}
