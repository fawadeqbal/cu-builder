import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Icon } from "@cvb/ui";
import { FittedCV } from "@/components/cv/FittedCV";
import { wrap } from "@/components/marketing/layout";
import { PublicPage } from "@/components/marketing/PublicPage";
import { EXAMPLE_CATEGORIES, EXAMPLES, examplePath, exampleTitle } from "@/lib/examples";

const DESCRIPTION = "Free CV examples for 24 roles, from software engineer and accountant to nurse, teacher and fresh graduate, with writing tips, key skills and sample summaries.";

export const metadata: Metadata = {
  title: "CV examples for 24 roles, with writing tips · CV Builder",
  description: DESCRIPTION,
  alternates: { canonical: "/cv-examples" },
  openGraph: { title: "CV examples for 24 roles", description: DESCRIPTION, url: "/cv-examples" },
};

export default function ExamplesIndex() {
  return (
    <PublicPage>
      <div className={`${wrap} flex flex-col gap-12 pb-20 pt-10`}>
        <header className="flex max-w-[48rem] flex-col gap-4">
          <span className="cvb-overline text-brand-ink">CV examples</span>
          <h1 className="font-display text-[34px] font-[740] leading-[40px] tracking-[-0.02em] text-balance text-ink sm:text-[46px] sm:leading-[52px]">CV examples you can edit and make your own</h1>
          <p className="text-lg leading-[28px] text-pretty text-ink-2">
            Pick your role to see a complete example CV, tips on what recruiters look for, the key skills to list and a sample summary. Open any example in the builder and replace the details with yours.
          </p>
          <p className="flex items-start gap-2 text-sm leading-6 text-ink-3">
            <Icon name="info" size={16} className="mt-1 shrink-0" />
            Every person, company and number in these examples is made up to show the format.
          </p>
        </header>

        {EXAMPLE_CATEGORIES.map((category) => {
          const list = EXAMPLES.filter((e) => e.category === category);
          if (!list.length) return null;
          const id = `cat-${category.toLowerCase().replace(/[^a-z]+/g, "-")}`;
          return (
            <section key={category} aria-labelledby={id} className="flex flex-col gap-5">
              <h2 id={id} className="cvb-h2">
                {category}
              </h2>
              <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
                {list.map((e) => (
                  <li key={e.slug} className="min-w-0">
                    {/* The CV preview contains links of its own, so only the title is the link; it covers the card. */}
                    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-line-strong hover:shadow-[var(--shadow-sm)] has-[a:focus-visible]:shadow-[var(--focus-ring)]">
                      <div aria-hidden="true" inert className="relative flex h-44 items-start justify-center overflow-hidden bg-surface-2 px-6 pt-5">
                        <div className="relative w-full overflow-hidden rounded-t-sm bg-paper shadow-[var(--shadow-sm)]" style={{ aspectRatio: "210 / 297" }}>
                          <FittedCV cv={e.cv} template={e.template} accent={e.accent} initialScale={0.3} />
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-4">
                        <Link href={examplePath(e.slug)} className="font-semibold text-ink outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-brand-ink">
                          {exampleTitle(e)}
                        </Link>
                        <span className="line-clamp-2 text-sm leading-5 text-ink-3">{e.intro}</span>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section aria-labelledby="own-title" className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex flex-col gap-2">
            <Badge tone="brand" pill icon="target" className="self-start">
              Free, no sign-up
            </Badge>
            <h2 id="own-title" className="cvb-h2">
              Already have a CV?
            </h2>
            <p className="text-sm leading-6 text-ink-2">Upload it to the ATS checker to see your score and exactly what to fix.</p>
          </div>
          <Button variant="primary" iconEnd="arrow-right" href="/ats-checker">
            Check my CV
          </Button>
        </section>
      </div>
    </PublicPage>
  );
}
