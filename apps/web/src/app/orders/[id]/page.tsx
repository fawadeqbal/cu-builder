import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderPage } from "@/components/services/OrderPage";

export const metadata: Metadata = { title: "Order · CV Builder" };

export default async function Page({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <OrderPage id={id} />
    </Suspense>
  );
}
