"use client";

import dynamic from "next/dynamic";

// The gallery reads the saved CV from localStorage, so it only renders in the browser.
const TemplateGallery = dynamic(() => import("./TemplateGallery"), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center bg-stone-50 text-sm text-stone-500">Loading templates…</div>,
});

export function GalleryLoader() {
  return <TemplateGallery />;
}
