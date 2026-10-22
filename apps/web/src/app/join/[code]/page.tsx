import type { Metadata } from "next";
import { JoinPage } from "@/components/orgs/JoinPage";

export const metadata: Metadata = { title: "Join · CV Builder" };

export default async function Page({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  return <JoinPage code={code} />;
}
