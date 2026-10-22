import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Breadcrumbs, Icon, PaperSheet } from "@cvb/ui";
import { templateMeta } from "@cvb/templates/catalog";
import { FittedCV } from "@/components/cv/FittedCV";
import { PublicPage } from "@/components/marketing/PublicPage";
import { wrap } from "@/components/marketing/layout";
import { JsonLd } from "@/components/seo/JsonLd";
import { CopyText } from "@/components/tools/CopyText";
import { OpenInBuilder } from "@/components/tools/OpenInBuilder";
import { EXAMPLES, exampleBySlug, examplePath, exampleTitle, relatedExamples } from "@/lib/examples";
import { faqPageJsonLd } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return EXAMPLES.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/cv-examples/[slug]">): Promise<Metadata> {
  const e = exampleBySlug((await params).slug);
  if (!e) return {};
  const title = `${exampleTitle(e)} and writing tips`;
  return {
    title: `${title} · CV Builder`,
    description: e.description,
    alternates: { canonical: examplePath(e.slug) },
    openGraph: { title, description: e.description, url: examplePath(e.slug), type: "article" },
    twitter: { card: "summary_large_image", title, description: e.description },
  };
}

export default async function ExamplePage({ params }: PageProps<"/cv-examples/[slug]">) {
  const e = exampleBySlug((await params).slug);
  if (!e) notFound();
  const template = templateMeta(e.template);
  const handoff = { cv: e.cv, template: e.template, accent: e.accent };

  return (
    <PublicPage>
      <JsonLd data={faqPageJsonLd(e.faqs)} />
      <div className={`${wrap} flex flex-col gap-10 pb-20 pt-8`}>
        <header className="flex flex-col gap-5">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/cv-examples", label: "CV examples" }, { label: e.role }]} />
          <div className="flex flex-col gap-3">
            <Badge tone="highlight" pill icon="file" className="self-start">
              Example CV · {e.category}
            </Badge>
            <h1 className="font-display text-[32px] font-[740] leading-[38px] tracking-[-0.02em] text-balance text-ink sm:text-[44px] sm:leading-[50px]">{exampleTitle(e)}</h1>
            <p className="max-w-[44rem] text-lg leading-[28px] text-pretty text-ink-2">{e.intro}</p>
          </div>
          <OpenInBuilder {...handoff} label="Use this example" size="lg" />
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
          <section aria-labelledby="example-title" className="flex flex-col gap-3 lg:sticky lg:top-20">
            <h2 id="example-title" className="cvb-sr">
              The example CV
            </h2>
            <PaperSheet maxWidth={600} className="mx-auto shadow-[var(--shadow-lg)]">
              <FittedCV cv={e.cv} template={e.template} accent={e.accent} initialScale={0.6} />
            </PaperSheet>
            <p className="flex items-start gap-2 text-sm leading-6 text-ink-3">
              <Icon name="info" size={16} className="mt-1 shrink-0" />
              <span>
                Example CV: {e.cv.personal.name}, the employers, schools and numbers are made up to show the format. Shown in the free {template.name} template; you can switch templates in the builder.
              </span>
            </p>
          </section>

          <div className="flex flex-col gap-10">
            <section aria-labelledby="tips-title" className="flex flex-col gap-4">
              <h2 id="tips-title" className="cvb-h2">
                How to write a {e.role.toLowerCase()} CV
              </h2>
              <ol className="flex flex-col gap-3">
                {e.tips.map((t, i) => (
                  <li key={t.title} className="flex gap-4 rounded-xl border border-line bg-surface p-5">
                    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-[720] text-brand-ink">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3 className="cvb-h3">{t.title}</h3>
                      <p className="text-sm leading-6 text-ink-2">{t.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="skills-title" className="flex flex-col gap-4">
              <h2 id="skills-title" className="cvb-h2">
                Key skills for a {e.role.toLowerCase()} CV
              </h2>
              <ul className="flex flex-wrap gap-2">
                {e.skills.map((s) => (
                  <li key={s} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2">
                    {s}
                  </li>
                ))}
              </ul>
              <p className="text-sm leading-6 text-ink-3">Only list skills you can talk about in an interview, and put the ones from the job advert first.</p>
            </section>

            <section aria-labelledby="summary-title" className="flex flex-col gap-4">
              <h2 id="summary-title" className="cvb-h2">
                Sample summary
              </h2>
              <figure className="flex flex-col gap-3 rounded-xl border border-line bg-gold-soft p-5">
                <figcaption className="cvb-overline text-ink-3">{e.sampleSummary.label}</figcaption>
                <blockquote className="text-base leading-7 text-ink">{e.sampleSummary.text}</blockquote>
                <CopyText text={e.sampleSummary.text} />
              </figure>
              <p className="text-sm leading-6 text-ink-3">
                Change it to your own facts. Need a different one?{" "}
                <Link href="/tools/summary-generator" className="font-semibold text-brand-ink underline-offset-4 hover:underline">
                  Write a summary with AI
                </Link>
                .
              </p>
            </section>

            <section aria-labelledby="faq-title" className="flex flex-col gap-4">
              <h2 id="faq-title" className="cvb-h2">
                Questions
              </h2>
              <div className="flex flex-col gap-3">
                {e.faqs.map((f) => (
                  <details key={f.q} className="cvb-card group [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg px-5 py-4 text-start font-semibold text-ink focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none">
                      <span className="flex-1">{f.q}</span>
                      <Icon name="plus" size={18} className="shrink-0 text-ink-3 transition group-open:rotate-45" />
                    </summary>
                    <p className="px-5 pb-5 text-sm leading-6 text-ink-2">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section aria-labelledby="next-title" className="flex flex-col gap-4 rounded-2xl bg-appbar-bg p-6 sm:p-8">
              <h2 id="next-title" className="font-display text-2xl font-[720] leading-8 text-appbar-ink">
                Make it yours
              </h2>
              <p className="text-base leading-7 text-appbar-ink-2">Open this example in the builder, replace the details with your own and download a PDF. No sign-up needed to start.</p>
              <div className="flex flex-wrap items-center gap-3">
                <OpenInBuilder {...handoff} label="Use this example" variant="highlight" />
                <Link
                  href="/ats-checker"
                  className="inline-flex min-h-10 items-center rounded-md px-4 text-sm font-semibold text-appbar-ink underline-offset-4 hover:bg-appbar-hover focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
                >
                  Check your own CV
                </Link>
              </div>
            </section>
          </div>
        </div>

        <nav aria-labelledby="related-title" className="flex flex-col gap-4 border-t border-line pt-10">
          <h2 id="related-title" className="cvb-h2">
            More CV examples
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {relatedExamples(e).map((r) => (
              <li key={r.slug}>
                <Link href={examplePath(r.slug)} className="group flex h-full flex-col gap-1 rounded-xl border border-line bg-surface p-4 hover:border-line-strong focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none">
                  <span className="font-semibold text-ink group-hover:text-brand-ink">{exampleTitle(r)}</span>
                  <span className="text-sm text-ink-3">{r.category}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/cv-examples" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-ink underline-offset-4 hover:underline">
            All CV examples <Icon name="arrow-right" size={16} className="rtl:rotate-180" />
          </Link>
        </nav>
      </div>
    </PublicPage>
  );
}
