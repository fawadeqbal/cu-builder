"use client";

import type { MeDto } from "@cvb/contracts";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Icon } from "@cvb/ui";
import { useHydrated } from "@/lib/hydrated";
import { useMe } from "@/lib/queries";
import { FullPageMessage } from "./ui/FullPageMessage";

/** Renders its children only for signed-in users (and admins, when asked); sends others to sign in. */
export function RequireAuth({ children, admin = false }: { children: (me: MeDto) => ReactNode; admin?: boolean }) {
  const me = useMe();
  const router = useRouter();
  const path = usePathname();
  // The session is only known in the browser: render "Loading…" until hydration so the server HTML
  // matches even when the session query has already resolved on the client.
  const hydrated = useHydrated();

  useEffect(() => {
    if (me.isSuccess && !me.data && !me.isFetching) {
      const query = typeof window === "undefined" ? "" : window.location.search;
      router.replace(`/sign-in?next=${encodeURIComponent(path + query)}`);
    }
  }, [me.isSuccess, me.data, me.isFetching, path, router]);

  if (hydrated && me.isError)
    return (
      <FullPageMessage>
        <span className="inline-flex items-center gap-2" role="alert">
          <Icon name="alert-triangle" size={18} /> We can&apos;t reach CV Builder right now. Please try again in a
          moment.
        </span>
      </FullPageMessage>
    );
  if (!hydrated || !me.data)
    return (
      <FullPageMessage>
        <span className="inline-flex items-center gap-2" role="status">
          <span className="cvb-spinner" aria-hidden="true" /> Loading…
        </span>
      </FullPageMessage>
    );
  if (admin && me.data.role !== "admin")
    return (
      <FullPageMessage>
        <span className="inline-flex items-center gap-2">
          <Icon name="lock" size={18} /> This page is for administrators.
        </span>
      </FullPageMessage>
    );
  return <>{children(me.data)}</>;
}
