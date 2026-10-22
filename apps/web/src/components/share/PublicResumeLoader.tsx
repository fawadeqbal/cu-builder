"use client";

import dynamic from "next/dynamic";
import { FullPageMessage } from "../ui/FullPageMessage";

const PublicResume = dynamic(() => import("./PublicResume"), {
  ssr: false,
  loading: () => <FullPageMessage>Loading CV…</FullPageMessage>,
});

export function PublicResumeLoader({ slug }: { slug: string }) {
  return <PublicResume slug={slug} />;
}
