"use client";

import dynamic from "next/dynamic";
import { FullPageMessage } from "../ui/FullPageMessage";

const PublicLetter = dynamic(() => import("./PublicLetter"), { ssr: false, loading: () => <FullPageMessage>Loading…</FullPageMessage> });

export function PublicLetterLoader({ slug }: { slug: string }) {
  return <PublicLetter slug={slug} />;
}
