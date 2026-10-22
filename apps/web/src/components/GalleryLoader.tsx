"use client";

import dynamic from "next/dynamic";
import { FullPageMessage } from "./ui/FullPageMessage";

// The gallery reads the saved CV from localStorage, so it only renders in the browser.
const TemplateGallery = dynamic(() => import("./TemplateGallery"), {
  ssr: false,
  loading: () => <FullPageMessage>Loading templates…</FullPageMessage>,
});

export function GalleryLoader() {
  return <TemplateGallery />;
}
