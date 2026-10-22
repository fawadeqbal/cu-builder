import type { Metadata } from "next";
import { OrdersPage } from "@/components/services/OrdersPage";

export const metadata: Metadata = { title: "Expert orders · CV Builder" };

export default function Page() {
  return <OrdersPage />;
}
