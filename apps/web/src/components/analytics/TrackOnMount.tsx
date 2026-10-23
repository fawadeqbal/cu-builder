"use client";

import type { ClientEventName } from "@cvb/contracts";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** Records one event when a (server-rendered) page mounts, e.g. a CV example being viewed. */
export function TrackOnMount({ name, props }: { name: ClientEventName; props?: Record<string, string | number | boolean> }) {
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    track(name, JSON.parse(key) as Record<string, string | number | boolean>);
  }, [name, key]);
  return null;
}
