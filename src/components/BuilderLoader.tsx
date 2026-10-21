"use client";

import dynamic from "next/dynamic";

// The builder reads saved data from localStorage, so it only renders in the browser.
const Builder = dynamic(() => import("./Builder"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-stone-100 text-sm text-stone-500">Loading CV Builder…</div>
  ),
});

export function BuilderLoader() {
  return <Builder />;
}
