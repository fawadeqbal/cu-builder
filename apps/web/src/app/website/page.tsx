import type { Metadata } from "next";
import { WebsiteEditor } from "@/components/portfolio/WebsiteEditor";

export const metadata: Metadata = { title: "My website · CV Builder" };

export default function Page() {
  return <WebsiteEditor />;
}
