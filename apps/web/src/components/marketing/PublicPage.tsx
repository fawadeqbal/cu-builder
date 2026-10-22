import type { ReactNode } from "react";
import { AppHeader } from "../AppHeader";
import { SiteFooter } from "./SiteFooter";

/** The frame for public marketing and tool pages: app bar, content, footer. */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <AppHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
