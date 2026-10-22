import type { Metadata } from "next";
import { BuilderLoader } from "@/components/BuilderLoader";

export const metadata: Metadata = {
  title: "Build your CV · CV Builder",
  description: "Write your CV step by step with a live preview, ATS checks and AI help. Free PDF download, no sign-up needed to start.",
};

export default function Page() {
  return <BuilderLoader />;
}
