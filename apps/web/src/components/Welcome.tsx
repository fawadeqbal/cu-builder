"use client";

import Link from "next/link";
import { TEMPLATES } from "@cvb/templates/catalog";
import { sampleCV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "./AppHeader";

type Props = {
  onStart: () => void;
  onExample: () => void;
  onImport: () => void;
  signedIn: boolean;
};

const POINTS = [
  { title: "welcome.f1", text: "welcome.f1d" },
  { title: "welcome.f2", text: "welcome.f2d" },
  { title: "welcome.f3", text: "welcome.f3d" },
] as const;

export function Welcome({ onStart, onExample, onImport, signedIn }: Props) {
  const t = useT();
  return (
    <div className="min-h-dvh bg-stone-100">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-5">
        <span className="grid size-8 place-items-center rounded-md bg-brand text-xs font-bold text-white">CV</span>
        <span className="text-base font-semibold tracking-tight text-stone-900">CV Builder</span>
        <nav className="ms-auto flex items-center gap-1 text-sm font-medium">
          <LanguageSwitcher />
          <Link href="/templates" className="hidden rounded-lg px-3 py-2 text-stone-600 hover:bg-white hover:text-stone-900 sm:block">
            {t("nav.templates")}
          </Link>
          <Link href="/pricing" className="rounded-lg px-3 py-2 text-stone-600 hover:bg-white hover:text-stone-900">
            {t("nav.pricing")}
          </Link>
          {signedIn ? (
            <Link href="/app" className="rounded-lg bg-stone-900 px-3 py-2 text-white hover:bg-stone-700">
              {t("nav.myCvs")}
            </Link>
          ) : (
            <Link href="/sign-in?next=/app" className="rounded-lg bg-white px-3 py-2 text-stone-800 shadow-xs ring-1 ring-stone-200 hover:bg-stone-50">
              {t("nav.signIn")}
            </Link>
          )}
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-4 lg:grid-cols-[1.05fr_1fr] lg:pt-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
              {t("welcome.title")}
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-stone-600">
              {t("welcome.lead")}
            </p>
          </div>

          <ol className="flex flex-col gap-4">
            {POINTS.map((p, i) => (
              <li key={p.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-brand ring-1 ring-stone-200">
                  {i + 1}
                </span>
                <div>
                  <div className="font-semibold text-stone-900">{t(p.title)}</div>
                  <div className="text-sm text-stone-600">{t(p.text)}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStart}
              className="rounded-lg bg-brand px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-dark"
            >
              {t("welcome.create")}
            </button>
            <button
              type="button"
              onClick={onExample}
              className="rounded-lg bg-white px-5 py-3 text-base font-medium text-stone-800 shadow-xs ring-1 ring-stone-300 hover:bg-stone-50"
            >
              {t("welcome.example")}
            </button>
          </div>
          <button
            type="button"
            onClick={onImport}
            className="self-start text-sm font-medium text-stone-500 underline-offset-4 hover:text-brand hover:underline"
          >
            {t("welcome.importJson")}
          </button>
          <Link
            href={signedIn ? "/app?import=1" : "/sign-up?next=%2Fapp%3Fimport%3D1"}
            className="self-start text-sm font-medium text-stone-500 underline-offset-4 hover:text-brand hover:underline"
          >
            {t("welcome.upload")}
          </Link>
          <Link
            href="/templates"
            className="self-start text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            {t("welcome.browse", { count: TEMPLATES.length })}
          </Link>
        </div>

        <div aria-hidden="true" className="relative hidden h-[540px] overflow-hidden lg:block">
          <div className="absolute left-1/2 top-0 w-[210mm] origin-top -translate-x-1/2 scale-[0.62]">
            <div className="paper rotate-[-1.5deg]">
              <CVDocument cv={sampleCV} template="classic" />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-stone-100" />
        </div>
      </main>
    </div>
  );
}
