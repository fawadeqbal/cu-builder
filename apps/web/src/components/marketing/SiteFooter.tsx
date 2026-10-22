"use client";

import Link from "next/link";
import { Logo } from "@cvb/ui";
import { useBranding } from "../branding/BrandingProvider";
import { wrap } from "./layout";

/** Footer columns for public pages. The landing page can use the same list (see FOOTER_COLUMNS). */
export const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Build", links: [{ href: "/builder", label: "CV builder" }, { href: "/new", label: "Write with AI" }, { href: "/templates", label: "Templates" }, { href: "/cv-examples", label: "CV examples" }] },
  {
    title: "Free tools",
    links: [
      { href: "/ats-checker", label: "ATS CV checker" },
      { href: "/tools/summary-generator", label: "CV summary generator" },
      { href: "/tools/bullet-improver", label: "Bullet point improver" },
      { href: "/tools", label: "All free tools" },
    ],
  },
  { title: "Job hunt", links: [{ href: "/jobs", label: "Jobs" }, { href: "/tracker", label: "Tracker" }, { href: "/interview", label: "Interview practice" }, { href: "/letters", label: "Cover letters" }] },
  { title: "Services", links: [{ href: "/experts", label: "Expert reviews" }, { href: "/pricing", label: "Pricing" }, { href: "/sign-in", label: "Sign in" }] },
];


export function SiteFooter() {
  const branding = useBranding();
  const product = branding?.productName || "CV Builder";
  return (
    <footer className="border-t border-line bg-surface">
      <div className={`${wrap} grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]`}>
        <div className="flex flex-col gap-3">
          <Logo href="/" product={product} logoSrc={branding?.logoUrl || null} />
          <p className="max-w-xs text-sm leading-6 text-ink-3">Build, check and tailor your CV, then find the job and prepare for the interview.</p>
        </div>
        {FOOTER_COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="flex flex-col gap-3">
            <span className="cvb-overline text-ink-3">{c.title}</span>
            <ul className="flex flex-col gap-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-2 hover:text-brand-ink hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className={`${wrap} py-5 text-xs text-ink-3`}>
          © {new Date().getFullYear()} {product}
        </p>
      </div>
    </footer>
  );
}
