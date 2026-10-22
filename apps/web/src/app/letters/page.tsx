import type { Metadata } from "next";
import { LettersPage } from "@/components/letters/LettersPage";

export const metadata: Metadata = { title: "Cover letters · CV Builder" };

export default function Page() {
  return <LettersPage />;
}
