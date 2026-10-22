import type { ReactNode } from "react";
import { Logo } from "@cvb/ui";
import { LanguageSwitcher } from "../AppHeader";

/** Centered card used by every sign-in related page (the Reading template: no app bar, one narrow column). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-(--layout-lg) items-center gap-3 px-4 py-5 sm:px-6">
        <Logo />
        <LanguageSwitcher className="ms-auto" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:px-6 sm:pt-10">
        <div className="flex w-full max-w-[26rem] flex-col gap-4">
          <div className="cvb-card flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <h1 className="cvb-h1">{title}</h1>
              {subtitle && <p className="text-ink-2">{subtitle}</p>}
            </div>
            <div>{children}</div>
          </div>
          {footer && <div className="text-center text-sm text-ink-2">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
