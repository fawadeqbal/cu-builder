/** Shapes shared by every provider, and the HTML-to-text helper. */
export type FeedQuery = { keywords: string; location?: string; remote?: boolean; page?: number };

export type FeedJob = {
  externalId: string;
  source: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary: string;
  url: string;
  /** Plain text, possibly a snippet. */
  description: string;
  postedAt: string | null;
};

export interface JobFeedProvider {
  readonly id: string;
  search(query: FeedQuery): Promise<FeedJob[]>;
  /** Optional: pre-load a slow source's data (see JobFeed.warm). */
  warm?(): Promise<unknown>;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n\s*/g, "\n")
    .trim();
}
