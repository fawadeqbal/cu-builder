"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@cvb/ui";
import { FullPageMessage } from "./ui/FullPageMessage";

// The builder reads saved data from localStorage, so it only renders in the browser.
const GuestBuilder = dynamic(() => import("./GuestBuilder"), {
  ssr: false,
  loading: () => (
    <FullPageMessage>
      <span className="flex items-center gap-3">
        <Spinner /> Loading CV Builder…
      </span>
    </FullPageMessage>
  ),
});

export function BuilderLoader() {
  return <GuestBuilder />;
}
