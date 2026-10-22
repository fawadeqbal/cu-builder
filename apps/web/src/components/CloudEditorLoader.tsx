"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@cvb/ui";
import { FullPageMessage } from "./ui/FullPageMessage";

// Keeps unsaved edits in localStorage, so it renders in the browser only.
const CloudEditor = dynamic(() => import("./CloudEditor"), {
  ssr: false,
  loading: () => (
    <FullPageMessage>
      <span className="flex items-center gap-3">
        <Spinner /> Opening your CV…
      </span>
    </FullPageMessage>
  ),
});

export function CloudEditorLoader({ id }: { id: string }) {
  return <CloudEditor id={id} />;
}
