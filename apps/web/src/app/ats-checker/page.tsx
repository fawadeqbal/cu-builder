import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Icon, type IconName } from "@cvb/ui";
import { wrap } from "@/components/marketing/layout";
import { PublicPage } from "@/components/marketing/PublicPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { AtsChecker } from "@/components/tools/AtsChecker";
import { webApplicationJsonLd } from "@/lib/seo";

const TITLE = "Free ATS CV checker";
const DESCRIPTION = "Upload your CV or paste the text to get a free ATS score, a clear list of fixes and the keywords you're missing from a job advert. No sign-up.";

export const metadata: Metadata = {
  title: `${TITLE}: score your CV in seconds · CV Builder`,
  description: DESCRIPTION,
  alternates: { canonical: "/ats-checker" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/ats-checker" },
};

const CHECKS: { icon: IconName; title: string; text: string }[] = [
  { icon: "file", title: "Parsing safety", text: "Whether a system can find your name, email and phone, and whether your headline uses plain text." },
  { icon: "list", title: "Completeness", text: "A job title, summary, experience, education, skills and a link: the sections recruiters expect." },
  { icon: "bar-chart", title: "Impact", text: "How many lines have a number and start with an action verb, and which jobs have no achievements yet." },
  { icon: "fit-page", title: "Length", text: "Whether the CV is too thin or too long, and how many pages it fills." },
  { icon: "eye", title: "Readability", text: "Very long lines, “I” and “my”, and skills written as sentences instead of lists." },
  { icon: "calendar", title: "Consistency", text: "Mixed date styles, jobs without dates and past roles written in the present tense." },
];

export default function Page() {
  return (
    <PublicPage>
      <JsonLd data={webApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: "/ats-checker" })} />
      <div className={`${wrap} flex flex-col gap-14 pb-20 pt-10`}>
        <div className="mx-auto flex w-full max-w-(--layout-md) flex-col gap-8">
          <header className="flex flex-col gap-4">
            <Badge tone="highlight" pill icon="target" className="self-start">
              Free · No sign-up · No AI
            </Badge>
            <h1 className="font-display text-[34px] font-[740] leading-[40px] tracking-[-0.02em] text-balance text-ink sm:text-[46px] sm:leading-[52px]">{TITLE}</h1>
            <p className="text-lg leading-[28px] text-pretty text-ink-2">
              See how applicant tracking systems read your CV, get a score out of 100 and a fix for every issue. Add a job advert to find the keywords you&apos;re missing.
            </p>
          </header>
          <AtsChecker />
        </div>

        <section aria-labelledby="checks-title" className="flex flex-col gap-6">
          <div className="flex max-w-[44rem] flex-col gap-3">
            <h2 id="checks-title" className="cvb-h2">
              What the checker looks at
            </h2>
            <p className="text-base leading-7 text-ink-2">
              The same rules run in our CV builder. They&apos;re written by people, not guessed by AI, so the same CV always gets the same score, and every point lost comes with a reason.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((c) => (
              <li key={c.title} className="flex gap-4 rounded-xl border border-line bg-surface p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                  <Icon name={c.icon} size={20} />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="cvb-h3">{c.title}</h3>
                  <p className="text-sm leading-6 text-ink-2">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="more-title" className="grid gap-4 md:grid-cols-3">
          <h2 id="more-title" className="cvb-sr">
            More free tools
          </h2>
          {[
            { href: "/cv-examples", title: "CV examples", text: "Complete example CVs for 24 roles, with tips and key skills." },
            { href: "/tools/summary-generator", title: "Summary generator", text: "Two summary drafts from your own details, with AI." },
            { href: "/tools/bullet-improver", title: "Bullet point improver", text: "Turn a duty into an achievement line, with AI." },
          ].map((t) => (
            <Link key={t.href} href={t.href} className="group flex flex-col gap-1 rounded-xl border border-line bg-surface p-5 hover:border-line-strong focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none">
              <span className="flex items-center gap-1 font-semibold text-ink group-hover:text-brand-ink">
                {t.title} <Icon name="arrow-right" size={16} className="rtl:rotate-180" />
              </span>
              <span className="text-sm leading-6 text-ink-2">{t.text}</span>
            </Link>
          ))}
        </section>
      </div>
    </PublicPage>
  );
}
