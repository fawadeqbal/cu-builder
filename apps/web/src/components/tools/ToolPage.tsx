import type { ReactNode } from "react";
import Link from "next/link";
import { Badge, Breadcrumbs, Icon } from "@cvb/ui";
import { wrap } from "../marketing/layout";
import { PublicPage } from "../marketing/PublicPage";
import { JsonLd } from "../seo/JsonLd";
import { webApplicationJsonLd } from "@/lib/seo";

/** Layout for a free AI writing tool: heading, the tool, short tips and links to the other tools. */
export function ToolPage({ path, title, description, lead, tips, children }: { path: string; title: string; description: string; lead: string; tips: { title: string; text: string }[]; children: ReactNode }) {
  return (
    <PublicPage>
      <JsonLd data={webApplicationJsonLd({ name: title, description, path })} />
      <div className={`${wrap} flex flex-col gap-12 pb-20 pt-8`}>
        <div className="mx-auto flex w-full max-w-(--layout-md) flex-col gap-8">
          <header className="flex flex-col gap-4">
            <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/tools", label: "Free tools" }, { label: title.replace(/^Free /, "") }]} />
            <Badge tone="highlight" pill icon="sparkle" className="self-start">
              Free · AI writing help
            </Badge>
            <h1 className="font-display text-[32px] font-[740] leading-[38px] tracking-[-0.02em] text-balance text-ink sm:text-[44px] sm:leading-[50px]">{title}</h1>
            <p className="text-lg leading-[28px] text-pretty text-ink-2">{lead}</p>
          </header>
          {children}
          <section aria-labelledby="tips-title" className="flex flex-col gap-4">
            <h2 id="tips-title" className="cvb-h2">
              Tips
            </h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {tips.map((t) => (
                <li key={t.title} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
                  <h3 className="cvb-h3">{t.title}</h3>
                  <p className="text-sm leading-6 text-ink-2">{t.text}</p>
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-2 text-sm leading-6 text-ink-3">
              <Icon name="info" size={16} className="mt-1 shrink-0" />
              The AI only uses what you type. Numbers it can&apos;t find in your text become [number] placeholders for you to fill in. What you type isn&apos;t saved.
            </p>
          </section>
        </div>
        <nav aria-label="More free tools" className="mx-auto flex w-full max-w-(--layout-md) flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm">
          {[
            { href: "/ats-checker", label: "ATS CV checker" },
            { href: "/tools/summary-generator", label: "Summary generator" },
            { href: "/tools/bullet-improver", label: "Bullet point improver" },
            { href: "/cv-examples", label: "CV examples" },
          ]
            .filter((l) => l.href !== path)
            .map((l) => (
              <Link key={l.href} href={l.href} className="font-semibold text-brand-ink underline-offset-4 hover:underline">
                {l.label}
              </Link>
            ))}
        </nav>
      </div>
    </PublicPage>
  );
}
