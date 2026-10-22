import type { Metadata } from "next";
import { Suspense } from "react";
import { OrgPage } from "@/components/orgs/OrgPage";

export const metadata: Metadata = { title: "Organisation · CV Builder" };

export default async function Page({ params }: PageProps<"/org/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <OrgPage id={id} />
    </Suspense>
  );
}
