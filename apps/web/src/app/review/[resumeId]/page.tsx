import type { Metadata } from "next";
import { ReviewPage } from "@/components/comments/ReviewPage";

export const metadata: Metadata = { title: "Review a CV · CV Builder", robots: { index: false } };

export default async function Page({ params }: PageProps<"/review/[resumeId]">) {
  const { resumeId } = await params;
  return <ReviewPage resumeId={resumeId} />;
}
