"use client";

import dynamic from "next/dynamic";
import { FullPageMessage } from "./ui/FullPageMessage";

// The builder reads saved data from localStorage, so it only renders in the browser.
const GuestBuilder = dynamic(() => import("./GuestBuilder"), {
  ssr: false,
  loading: () => <FullPageMessage>Loading CV Builder…</FullPageMessage>,
});

export function BuilderLoader() {
  return <GuestBuilder />;
}
