import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "../AppHeader";

/** Centered card used by every sign-in related page. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-stone-100">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-2 px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-brand text-xs font-bold text-white">CV</span>
          <span className="text-base font-semibold tracking-tight text-stone-900">CV Builder</span>
        </Link>
        <LanguageSwitcher className="ms-auto" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-stone-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
