import { brandImage, OG_SIZE } from "@/lib/og";
import { EXAMPLES, exampleBySlug, exampleTitle } from "@/lib/examples";

export const alt = "CV example";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return EXAMPLES.map((e) => ({ slug: e.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const e = exampleBySlug((await params).slug);
  return brandImage({
    eyebrow: "Free CV example",
    title: e ? exampleTitle(e) : "CV examples",
    subtitle: e ? `${e.tips.length} writing tips, key skills and a sample summary. Open it in the builder and make it yours.` : "Examples for two dozen roles, ready to edit.",
  });
}
