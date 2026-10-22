import type { Metadata } from "next";
import { PublicResumeLoader } from "@/components/share/PublicResumeLoader";

// Shared CVs are personal: keep them out of search engines.
export const metadata: Metadata = { title: "CV · CV Builder", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  return <PublicResumeLoader slug={slug} />;
}
