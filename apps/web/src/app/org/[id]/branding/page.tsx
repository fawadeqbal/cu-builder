import type { Metadata } from "next";
import { BrandingEditor } from "@/components/branding/BrandingEditor";

export const metadata: Metadata = { title: "Branding · CV Builder" };

export default async function Page({ params }: PageProps<"/org/[id]/branding">) {
  const { id } = await params;
  return <BrandingEditor orgId={id} />;
}
