import type { Metadata } from "next";
import { LetterEditorLoader } from "@/components/letters/LetterEditorLoader";

export const metadata: Metadata = { title: "Cover letter · CV Builder" };

export default async function Page({ params }: PageProps<"/letters/[id]">) {
  const { id } = await params;
  return <LetterEditorLoader id={id} />;
}
