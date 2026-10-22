"use client";

import dynamic from "next/dynamic";
import { FullPageMessage } from "./ui/FullPageMessage";

// Keeps unsaved edits in localStorage, so it renders in the browser only.
const CloudEditor = dynamic(() => import("./CloudEditor"), {
  ssr: false,
  loading: () => <FullPageMessage>Opening your CV…</FullPageMessage>,
});

export function CloudEditorLoader({ id }: { id: string }) {
  return <CloudEditor id={id} />;
}
