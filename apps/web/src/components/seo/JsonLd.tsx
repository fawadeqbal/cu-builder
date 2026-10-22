import { serializeJsonLd, type JsonLdObject } from "@/lib/seo";

/** schema.org structured data for search engines (render it from a server page). */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
