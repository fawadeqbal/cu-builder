import { z } from "zod";

/** The funnel from the scope document, plus a few feature events. Never put personal data in props. */
export const ANALYTICS_EVENTS = [
  "visit",
  "cv_started",
  "cv_completed",
  "pdf_downloaded",
  "docx_downloaded",
  "signed_up",
  "checkout_started",
  "purchased",
  "template_selected",
  "share_link_created",
  "import_started",
] as const;

export const TrackSchema = z.object({
  anonymousId: z.string().min(8).max(64),
  events: z
    .array(
      z.object({
        name: z.enum(ANALYTICS_EVENTS),
        props: z.record(z.string(), z.union([z.string().max(120), z.number(), z.boolean()])).optional(),
      }),
    )
    .min(1)
    .max(20),
});
export type TrackDto = z.output<typeof TrackSchema>;
