"use client";

import Link from "next/link";
import { TEMPLATES } from "@/templates/catalog";
import { sampleCV } from "@/lib/sample";
import { ClassicTemplate } from "@/templates/ClassicTemplate";

type Props = {
  onStart: () => void;
  onExample: () => void;
  onImport: () => void;
};

const POINTS = [
  { title: "Answer simple questions", text: "One short step at a time, with tips on what to write." },
  { title: "Watch it take shape", text: "Your CV updates live in a clean, recruiter-friendly layout." },
  { title: "Download a PDF", text: "Pick a template and save an A4 PDF, ready to send." },
];

export function Welcome({ onStart, onExample, onImport }: Props) {
  return (
    <div className="min-h-dvh bg-stone-100">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-5">
        <span className="grid size-8 place-items-center rounded-md bg-brand text-xs font-bold text-white">CV</span>
        <span className="text-base font-semibold tracking-tight text-stone-900">CV Builder</span>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-4 lg:grid-cols-[1.05fr_1fr] lg:pt-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
              Make a professional CV in a few easy steps
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-stone-600">
              Free, no sign-up. Fill in your details, choose a design and download your CV as a PDF.
            </p>
          </div>

          <ol className="flex flex-col gap-4">
            {POINTS.map((p, i) => (
              <li key={p.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-brand ring-1 ring-stone-200">
                  {i + 1}
                </span>
                <div>
                  <div className="font-semibold text-stone-900">{p.title}</div>
                  <div className="text-sm text-stone-600">{p.text}</div>
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
              Create my CV
            </button>
            <button
              type="button"
              onClick={onExample}
              className="rounded-lg bg-white px-5 py-3 text-base font-medium text-stone-800 shadow-xs ring-1 ring-stone-300 hover:bg-stone-50"
            >
              Start from an example
            </button>
          </div>
          <button
            type="button"
            onClick={onImport}
            className="self-start text-sm font-medium text-stone-500 underline-offset-4 hover:text-brand hover:underline"
          >
            Already have a saved CV file? Import it
          </button>
          <Link
            href="/templates"
            className="self-start text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Browse {TEMPLATES.length} CV templates →
          </Link>
        </div>

        <div aria-hidden="true" className="relative hidden h-[540px] overflow-hidden lg:block">
          <div className="absolute left-1/2 top-0 w-[210mm] origin-top -translate-x-1/2 scale-[0.62]">
            <div className="paper rotate-[-1.5deg]">
              <ClassicTemplate cv={sampleCV} />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-stone-100" />
        </div>
      </main>
    </div>
  );
}
