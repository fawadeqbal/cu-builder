import type { ReactNode } from "react";

export function FullPageMessage({ children }: { children: ReactNode }) {
  return <div className="grid h-dvh place-items-center bg-stone-100 px-6 text-center text-sm text-stone-500">{children}</div>;
}
