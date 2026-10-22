import type { Metadata } from "next";
import { ExpertProfilePage } from "@/components/services/ExpertProfilePage";

export const metadata: Metadata = { title: "Expert · CV Builder" };

export default async function Page({ params }: PageProps<"/experts/[id]">) {
  const { id } = await params;
  return <ExpertProfilePage id={id} />;
}
