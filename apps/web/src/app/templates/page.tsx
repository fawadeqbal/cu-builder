import type { Metadata } from "next";
import { Suspense } from "react";
import { GalleryLoader } from "@/components/GalleryLoader";

export const metadata: Metadata = {
  title: "Templates · CV Builder",
  description: "Browse CV templates by tier, style and layout, preview them with your own CV, and pick one.",
};

export default function TemplatesPage() {
  return (
    <Suspense>
      <GalleryLoader />
    </Suspense>
  );
}
