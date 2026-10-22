import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@cvb/ui";
import { wrap } from "@/components/marketing/layout";
import { PublicPage } from "@/components/marketing/PublicPage";

const DESCRIPTION = "Free CV tools: an ATS checker, an AI summary generator, an AI bullet point improver and CV examples for 24 roles. No sign-up needed.";

export const metadata: Metadata = {
  title: "Free CV tools · CV Builder",
  description: DESCRIPTION,
  alternates: { canonical: "/tools" },
  openGraph: { title: "Free CV tools", description: DESCRIPTION, url: "/tools" },
};

const TOOLS: { href: string; icon: IconName; title: string; text: string; tag: string }[] = [
  { href: "/ats-checker", icon: "target", title: "ATS CV checker", text: "Upload your CV for a score out of 100, a fix for every issue and the keywords missing from a job advert.", tag: "No AI · free, no sign-up" },
  { href: "/tools/summary-generator", icon: "sparkle", title: "CV summary generator", text: "Add your job title, skills and highlights, and get two summary drafts written from your own facts.", tag: "AI · 3 free tries a day" },
  { href: "/tools/bullet-improver", icon: "edit", title: "Bullet point improver", text: "Turn “responsible for…” into an achievement line that starts with an action verb.", tag: "AI · 3 free tries a day" },
  { href: "/cv-examples", icon: "files", title: "CV examples", text: "Complete example CVs for 24 roles, with tips, key skills and a sample summary.", tag: "Open any example in the builder" },
];

export default function ToolsIndex() {
  return (
    <PublicPage>
      <div className={`${wrap} flex flex-col gap-10 pb-20 pt-10`}>
        <header className="flex max-w-[44rem] flex-col gap-4">
          <span className="cvb-overline text-brand-ink">Free tools</span>
          <h1 className="font-display text-[34px] font-[740] leading-[40px] tracking-[-0.02em] text-balance text-ink sm:text-[46px] sm:leading-[52px]">Free tools for a better CV</h1>
          <p className="text-lg leading-[28px] text-pretty text-ink-2">Check your CV, fix weak lines and see examples for your role. No account needed; nothing you paste is saved.</p>
        </header>
        <ul className="grid gap-4 md:grid-cols-2">
          {TOOLS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="group flex h-full gap-4 rounded-xl border border-line bg-surface p-6 transition hover:border-line-strong hover:shadow-[var(--shadow-sm)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                  <Icon name={t.icon} size={22} />
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex items-center gap-1 font-display text-lg font-[700] text-ink group-hover:text-brand-ink">
                    {t.title} <Icon name="arrow-right" size={16} className="transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </span>
                  <span className="text-sm leading-6 text-ink-2">{t.text}</span>
                  <span className="cvb-caption">{t.tag}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PublicPage>
  );
}
