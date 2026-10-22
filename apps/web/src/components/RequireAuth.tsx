"use client";

import type { MeDto } from "@cvb/contracts";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/lib/queries";
import { FullPageMessage } from "./ui/FullPageMessage";

/** Renders its children only for signed-in users (and admins, when asked); sends others to sign in. */
export function RequireAuth({ children, admin = false }: { children: (me: MeDto) => ReactNode; admin?: boolean }) {
  const me = useMe();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (me.isSuccess && !me.data && !me.isFetching) {
      const query = typeof window === "undefined" ? "" : window.location.search;
      router.replace(`/sign-in?next=${encodeURIComponent(path + query)}`);
    }
  }, [me.isSuccess, me.data, me.isFetching, path, router]);

  if (me.isError) return <FullPageMessage>We can&apos;t reach CV Builder right now. Please try again in a moment.</FullPageMessage>;
  if (!me.data) return <FullPageMessage>Loading…</FullPageMessage>;
  if (admin && me.data.role !== "admin") return <FullPageMessage>This page is for administrators.</FullPageMessage>;
  return <>{children(me.data)}</>;
}
