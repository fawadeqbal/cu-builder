"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useGuestDocument } from "@/lib/document";
import { useMe } from "@/lib/queries";
import Builder from "./Builder";
import { Spinner } from "@cvb/ui";
import { FullPageMessage } from "./ui/FullPageMessage";

/** The builder for visitors without an account. Signed-in people go to their CVs instead. */
export default function GuestBuilder() {
  const me = useMe();
  const router = useRouter();
  const doc = useGuestDocument();

  useEffect(() => {
    if (me.data) router.replace("/app");
  }, [me.data, router]);

  if (me.isLoading || me.data)
    return (
      <FullPageMessage>
        <span className="flex items-center gap-3">
          <Spinner /> Loading CV Builder…
        </span>
      </FullPageMessage>
    );
  return <Builder doc={doc} />;
}
