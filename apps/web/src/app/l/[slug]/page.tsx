import type { Metadata } from "next";
import { PublicLetterLoader } from "@/components/letters/PublicLetterLoader";

export const metadata: Metadata = { title: "Cover letter · CV Builder", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/l/[slug]">) {
  const { slug } = await params;
  return <PublicLetterLoader slug={slug} />;
}
