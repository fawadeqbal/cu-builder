import type { ReactNode } from "react";

export function FullPageMessage({ children }: { children: ReactNode }) {
  return <div className="grid h-dvh place-items-center bg-canvas px-6 text-center text-sm text-ink-3">{children}</div>;
}
