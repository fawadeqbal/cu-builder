import type { PublicSiteDto } from "@cvb/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicSite } from "@/components/portfolio/PublicSite";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/** One request per render: metadata and page share it (and the visit is counted once). */
const loadSite = cache(async (slug: string): Promise<PublicSiteDto | null> => {
  const res = await fetch(`${API}/api/v1/public/sites/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  return res?.ok ? ((await res.json()) as PublicSiteDto) : null;
});

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const site = await loadSite((await params).slug);
  if (!site) return { title: "Site not found", robots: { index: false } };
  const name = site.data.personal.name || site.ownerName;
  const description = (site.content.about || site.data.summary || site.data.personal.headline).slice(0, 160);
  return {
    title: site.data.personal.headline ? `${name} · ${site.data.personal.headline}` : name,
    description,
    alternates: { canonical: site.url },
    openGraph: { title: name, description, url: site.url, type: "profile" },
    twitter: { card: "summary", title: name, description },
  };
}

export default async function Page({ params }: PageProps<"/p/[slug]">) {
  const site = await loadSite((await params).slug);
  if (!site) notFound();
  return <PublicSite site={site} />;
}
