"use client";

import dynamic from "next/dynamic";
import { FullPageMessage } from "../ui/FullPageMessage";

const LetterEditor = dynamic(() => import("./LetterEditor"), { ssr: false, loading: () => <FullPageMessage>Opening your letter…</FullPageMessage> });

export function LetterEditorLoader({ id }: { id: string }) {
  return <LetterEditor id={id} />;
}
