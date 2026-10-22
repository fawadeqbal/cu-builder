import type { Metadata } from "next";
import { Suspense } from "react";
import { CloudEditorLoader } from "@/components/CloudEditorLoader";

export const metadata: Metadata = { title: "Edit CV · CV Builder" };

export default async function Page({ params }: PageProps<"/edit/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <CloudEditorLoader id={id} />
    </Suspense>
  );
}
