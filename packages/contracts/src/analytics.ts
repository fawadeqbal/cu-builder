import { CURRENCIES, DEVICE_CLASSES, RANGE_PRESETS } from "@cvb/domain";
import { z } from "zod";

// ─── Event catalog ───────────────────────────────────────────────────────────

export type EventGroup = "acquisition" | "builder" | "export" | "tools" | "ai" | "jobs" | "sharing" | "import" | "trust" | "billing" | "account";

type EventSpec = {
  label: string;
  group: EventGroup;
  /** Sent by the browser (or the extension). Server-only events can't be posted to /events. */
  client: boolean;
  /** The product feature it counts towards in the usage report. */
  feature?: FeatureKey;
};

export const FEATURES = {
  builder: "CV builder",
  downloads: "Downloads",
  templates: "Templates",
  ats_check: "ATS check",
  free_tools: "Free tools",
  cv_examples: "CV examples",
  ai: "AI writing",
  tailoring: "Tailoring",
  cover_letters: "Cover letters",
  interviews: "Interview practice",
  tracker: "Job tracker",
  sharing: "Share links",
  import: "Import",
  extension: "Browser extension",
  talent: "Talent search opt-in",
} as const;
export type FeatureKey = keyof typeof FEATURES;

/**
 * Every product event. Props never hold personal data: no names, emails, CV text, job titles
 * or free text, only ids of our own catalog (template, tool, offer) and small enums.
 * To add an event: add it here, call `track()` (web) or `AnalyticsRecorder.record()` (API).
 */
export const ANALYTICS_EVENT_CATALOG = {
  visit: { label: "Visit (legacy)", group: "acquisition", client: true },
  page_view: { label: "Page view", group: "acquisition", client: true },
  landing_cta_clicked: { label: "Landing call to action clicked", group: "acquisition", client: true },
  pricing_viewed: { label: "Pricing viewed", group: "billing", client: true },
  currency_switched: { label: "Currency switched", group: "billing", client: true },
  checkout_started: { label: "Checkout started", group: "billing", client: true },
  purchased: { label: "Returned from checkout", group: "billing", client: true },

  cv_started: { label: "CV started", group: "builder", client: true, feature: "builder" },
  builder_step_reached: { label: "Builder step reached", group: "builder", client: true, feature: "builder" },
  cv_completed: { label: "CV completed", group: "builder", client: true, feature: "builder" },
  template_selected: { label: "Template selected", group: "builder", client: true, feature: "templates" },
  pdf_downloaded: { label: "PDF downloaded", group: "export", client: true, feature: "downloads" },
  docx_downloaded: { label: "Word downloaded", group: "export", client: true, feature: "downloads" },
  txt_downloaded: { label: "Text downloaded", group: "export", client: true, feature: "downloads" },

  ats_check_run: { label: "ATS check run", group: "tools", client: true, feature: "ats_check" },
  free_tool_used: { label: "Free tool used", group: "tools", client: true, feature: "free_tools" },
  cv_example_viewed: { label: "CV example viewed", group: "tools", client: true, feature: "cv_examples" },
  cv_example_used: { label: "CV example used", group: "tools", client: true, feature: "cv_examples" },

  ai_action_used: { label: "AI action used", group: "ai", client: true, feature: "ai" },
  cv_tailored: { label: "CV tailored to a job", group: "ai", client: true, feature: "tailoring" },
  cover_letter_created: { label: "Cover letter created", group: "ai", client: true, feature: "cover_letters" },
  interview_session_started: { label: "Interview practice started", group: "ai", client: true, feature: "interviews" },

  application_added: { label: "Application added to tracker", group: "jobs", client: true, feature: "tracker" },
  extension_tailor: { label: "Tailored from the extension", group: "jobs", client: true, feature: "extension" },
  talent_opt_in: { label: "Opted in to talent search", group: "jobs", client: true, feature: "talent" },

  share_link_created: { label: "Share link created", group: "sharing", client: true, feature: "sharing" },
  share_link_viewed: { label: "Shared CV viewed", group: "sharing", client: true },

  import_started: { label: "Import started", group: "import", client: true, feature: "import" },
  linkedin_import_started: { label: "LinkedIn import started", group: "import", client: true, feature: "import" },
  import_finished: { label: "Import finished", group: "import", client: false },

  review_prompt_shown: { label: "Review prompt shown", group: "trust", client: true },
  review_submitted: { label: "Review submitted", group: "trust", client: true },

  signed_up: { label: "Signed up", group: "account", client: false },
  purchase_completed: { label: "Purchase completed", group: "billing", client: false },
  subscription_started: { label: "Subscription started", group: "billing", client: false },
  subscription_renewed: { label: "Subscription renewed", group: "billing", client: false },
  subscription_cancelled: { label: "Subscription cancelled", group: "billing", client: false },
  payment_failed: { label: "Payment failed", group: "billing", client: false },
  payment_refunded: { label: "Payment refunded", group: "billing", client: false },
} as const satisfies Record<string, EventSpec>;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_CATALOG;
export const ANALYTICS_EVENTS = Object.keys(ANALYTICS_EVENT_CATALOG) as [AnalyticsEventName, ...AnalyticsEventName[]];
export type ClientEventName = {
  [K in AnalyticsEventName]: (typeof ANALYTICS_EVENT_CATALOG)[K]["client"] extends true ? K : never;
}[AnalyticsEventName];
export type ServerEventName = Exclude<AnalyticsEventName, ClientEventName>;
export const CLIENT_EVENTS = ANALYTICS_EVENTS.filter((e) => ANALYTICS_EVENT_CATALOG[e].client) as [ClientEventName, ...ClientEventName[]];

export const eventLabel = (name: string): string =>
  (ANALYTICS_EVENT_CATALOG as Record<string, EventSpec>)[name]?.label ?? name.replace(/_/g, " ");

/** Where a CV was started from (`cv_started.source`). */
export const CV_SOURCES = ["blank", "example", "import", "ai", "linkedin", "cv_example", "ats_check", "duplicate"] as const;

// ─── Ingestion (POST /events) ────────────────────────────────────────────────

const short = (max: number) => z.string().trim().max(max);

export const TouchSchema = z.object({
  source: short(100).optional(),
  medium: short(100).optional(),
  campaign: short(100).optional(),
  term: short(100).optional(),
  content: short(100).optional(),
  referrer: short(253).optional(),
  landing: short(200).optional(),
});
export type TouchDto = z.output<typeof TouchSchema>;

export const EventPropsSchema = z
  .record(z.string().max(40), z.union([z.string().max(120), z.number().finite(), z.boolean()]))
  .refine((p) => Object.keys(p).length <= 12, "At most 12 props");

export const TrackSchema = z.object({
  anonymousId: z.string().min(8).max(64),
  /** 30-minute session id; older clients don't send it. */
  sessionId: z.string().min(8).max(64).optional(),
  context: z
    .object({
      locale: short(12).optional(),
      currency: z.enum(CURRENCIES).optional(),
      /** Country guessed from the browser's time zone; a proxy header wins when present. */
      tzCountry: z.string().length(2).optional(),
      /** The session's attribution (last touch) and the device's first visit (first touch). */
      last: TouchSchema.optional(),
      first: TouchSchema.optional(),
      /** The extension says so; everything else is the web app. */
      client: z.enum(["web", "extension"]).optional(),
    })
    .optional(),
  events: z
    .array(
      z.object({
        name: z.enum(CLIENT_EVENTS),
        path: short(200).optional(),
        props: EventPropsSchema.optional(),
      }),
    )
    .min(1)
    .max(20),
});
export type TrackDto = z.output<typeof TrackSchema>;

/** First-touch attribution stored on the user once, when their anonymous id is linked at sign-up. */
export const AcquisitionSchema = z.object({
  source: z.string(),
  medium: z.string(),
  campaign: z.string().nullable(),
  term: z.string().nullable(),
  content: z.string().nullable(),
  referrer: z.string().nullable(),
  landing: z.string().nullable(),
  device: z.string().nullable(),
  country: z.string().nullable(),
  locale: z.string().nullable(),
  firstSeenAt: z.string(),
});
export type AcquisitionDto = z.output<typeof AcquisitionSchema>;

// ─── Reports (GET /admin/analytics/*) ────────────────────────────────────────

const flag = z
  .enum(["0", "1", "true", "false"])
  .optional()
  .transform((v) => v === "1" || v === "true");

export const AnalyticsQuerySchema = z.object({
  range: z.enum(RANGE_PRESETS).default("30d"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compare: flag,
  source: short(100).min(1).optional(),
  medium: short(100).min(1).optional(),
  campaign: short(100).min(1).optional(),
  device: z.enum(DEVICE_CLASSES).optional(),
  country: z.string().regex(/^[A-Za-z]{2}$/).transform((c) => c.toUpperCase()).optional(),
  locale: short(12).min(2).optional(),
  currency: z.enum(CURRENCIES).optional(),
});
export type AnalyticsQuery = z.output<typeof AnalyticsQuerySchema>;
export type AnalyticsFilters = Pick<AnalyticsQuery, "source" | "medium" | "campaign" | "device" | "country" | "locale" | "currency">;

export const PeriodSchema = z.object({
  from: z.string(),
  to: z.string(),
  prevFrom: z.string(),
  prevTo: z.string(),
  bucket: z.enum(["day", "week", "month"]),
  days: z.number(),
  compare: z.boolean(),
});

const MetricSchema = z.object({ value: z.number(), previous: z.number().nullable(), change: z.number().nullable() });
export type MetricDto = z.output<typeof MetricSchema>;
const PointSchema = z.object({ date: z.string(), value: z.number(), previous: z.number().nullable() });
export type PointDto = z.output<typeof PointSchema>;
const MoneySchema = z.object({ currency: z.enum(CURRENCIES), cents: MetricSchema, series: z.array(PointSchema) });

export const AnalyticsOverviewSchema = z.object({
  period: PeriodSchema,
  /** When the first event was recorded, so the UI can explain an empty report. */
  dataSince: z.string().nullable(),
  tiles: z.object({
    visitors: MetricSchema,
    sessions: MetricSchema,
    signups: MetricSchema,
    cvsCreated: MetricSchema,
    downloads: MetricSchema,
    payingCustomers: MetricSchema,
  }),
  rates: z.object({ visitorToCv: MetricSchema, visitorToSignup: MetricSchema, signupToPaid: MetricSchema }),
  /** Collected revenue per currency (never added across currencies). */
  revenue: z.array(MoneySchema),
  series: z.object({
    visitors: z.array(PointSchema),
    sessions: z.array(PointSchema),
    signups: z.array(PointSchema),
    cvsCreated: z.array(PointSchema),
    downloads: z.array(PointSchema),
    payingCustomers: z.array(PointSchema),
  }),
});
export type AnalyticsOverviewDto = z.output<typeof AnalyticsOverviewSchema>;

const FunnelStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number(),
  previous: z.number().nullable(),
  ofFirst: z.number(),
  ofPrevious: z.number(),
  dropOff: z.number(),
});
export type FunnelStepDto = z.output<typeof FunnelStepSchema>;
const FunnelBreakdownSchema = z.array(z.object({ value: z.string(), steps: z.array(FunnelStepSchema) }));

export const AnalyticsFunnelSchema = z.object({
  period: PeriodSchema,
  dataSince: z.string().nullable(),
  main: z.object({ steps: z.array(FunnelStepSchema), bySource: FunnelBreakdownSchema, byDevice: FunnelBreakdownSchema }),
  freeTool: z.object({ steps: z.array(FunnelStepSchema), byTool: FunnelBreakdownSchema }),
});
export type AnalyticsFunnelDto = z.output<typeof AnalyticsFunnelSchema>;

const AcquisitionRowSchema = z.object({
  value: z.string(),
  /** Page kind for landing pages (cv_example, free_tool, home…). */
  kind: z.string().optional(),
  visitors: z.number(),
  previousVisitors: z.number().nullable(),
  signups: z.number(),
  paid: z.number(),
  signupRate: z.number(),
  paidRate: z.number(),
});
export type AcquisitionRowDto = z.output<typeof AcquisitionRowSchema>;

export const AnalyticsAcquisitionSchema = z.object({
  period: PeriodSchema,
  dataSince: z.string().nullable(),
  visitors: z.object({ new: MetricSchema, returning: MetricSchema }),
  series: z.array(z.object({ date: z.string(), new: z.number(), returning: z.number() })),
  sources: z.array(AcquisitionRowSchema),
  mediums: z.array(AcquisitionRowSchema),
  campaigns: z.array(AcquisitionRowSchema),
  referrers: z.array(AcquisitionRowSchema),
  landingPages: z.array(AcquisitionRowSchema),
  countries: z.array(AcquisitionRowSchema),
  devices: z.array(AcquisitionRowSchema),
});
export type AnalyticsAcquisitionDto = z.output<typeof AnalyticsAcquisitionSchema>;

const SalesLineSchema = z.object({ count: MetricSchema, cents: MetricSchema });

export const RevenueCurrencySchema = z.object({
  currency: z.enum(CURRENCIES),
  mrr: MetricSchema,
  activeSubscriptions: MetricSchema,
  movements: z.object({
    new: MetricSchema,
    expansion: MetricSchema,
    contraction: MetricSchema,
    churn: MetricSchema,
    reactivation: MetricSchema,
    net: MetricSchema,
  }),
  revenue: MetricSchema,
  refunds: MetricSchema,
  failedPayments: MetricSchema,
  payingCustomers: MetricSchema,
  arppu: MetricSchema,
  /** MRR lost (churn + contraction) over MRR at the start of the period; null without a starting MRR. */
  churnRate: z.object({ value: z.number().nullable(), previous: z.number().nullable() }),
  sales: z.object({
    subscriptions: SalesLineSchema,
    passes: SalesLineSchema,
    creditPacks: SalesLineSchema,
    expertOrders: SalesLineSchema,
  }),
  mrrSeries: z.array(PointSchema),
  revenueSeries: z.array(PointSchema),
  /** MRR movements per bucket (churn and contraction as positive amounts lost). */
  movementSeries: z.array(
    z.object({ date: z.string(), new: z.number(), expansion: z.number(), contraction: z.number(), churn: z.number(), reactivation: z.number() }),
  ),
  byPlan: z.array(z.object({ plan: z.string(), interval: z.string(), subscriptions: z.number(), mrrCents: z.number() })),
});
export type RevenueCurrencyDto = z.output<typeof RevenueCurrencySchema>;

export const AnalyticsRevenueSchema = z.object({
  period: PeriodSchema,
  currencies: z.array(RevenueCurrencySchema),
});
export type AnalyticsRevenueDto = z.output<typeof AnalyticsRevenueSchema>;

export const AnalyticsUsageSchema = z.object({
  period: PeriodSchema,
  dataSince: z.string().nullable(),
  /** Signed-in people with any activity: average per day, and in the last 7 / 30 days of the period. */
  dau: MetricSchema,
  wau: MetricSchema,
  mau: MetricSchema,
  /** Average DAU over MAU (0–1). */
  stickiness: MetricSchema,
  activeSeries: z.array(PointSchema),
  features: z.array(
    z.object({ key: z.string(), label: z.string(), events: z.number(), users: z.number(), previousUsers: z.number().nullable() }),
  ),
  cohorts: z.object({
    weeks: z.number(),
    rows: z.array(
      z.object({ week: z.string(), size: z.number(), cells: z.array(z.object({ users: z.number(), rate: z.number() }).nullable()) }),
    ),
    average: z.array(z.number().nullable()),
  }),
  topEvents: z.array(z.object({ name: z.string(), label: z.string(), events: z.number(), people: z.number() })),
  aiCredits: z.object({ spent: MetricSchema, users: MetricSchema }),
});
export type AnalyticsUsageDto = z.output<typeof AnalyticsUsageSchema>;
