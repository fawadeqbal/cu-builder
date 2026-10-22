import { clean, TEMPLATES } from "./cv";
import type { CV, TemplateId } from "./types";

export type Check = { label: string; status: "ok" | "warn"; detail: string };

const ACTION_VERBS = new Set(
  (
    "achieved built led designed developed created implemented improved increased reduced launched managed delivered " +
    "automated optimized optimised migrated integrated architected shipped owned drove established streamlined mentored " +
    "coordinated analysed analyzed resolved maintained deployed configured wrote tested refactored scaled secured " +
    "introduced organised organized planned trained supported negotiated generated handled performed produced " +
    "converted contributed collaborated spearheaded oversaw redesigned rebuilt cut saved grew " +
    "build add set turn design develop create implement improve lead manage own maintain deliver write test deploy " +
    "migrate integrate ship automate optimize reduce increase launch support train mentor run handle coordinate analyse analyze"
  ).split(" "),
);

export function cvText(cv: CV): string {
  const parts = [
    cv.personal.headline,
    cv.personal.tagline,
    cv.summary,
    ...cv.experience.flatMap((e) => [e.role, e.company, ...e.bullets, e.stack]),
    ...cv.projects.flatMap((p) => [p.name, ...p.bullets, p.stack]),
    ...cv.skills.flatMap((s) => [s.category, s.items]),
    ...cv.education.flatMap((e) => [e.degree, e.school, e.details]),
    ...cv.certificates.map((c) => c.name),
  ];
  return parts.join(" \n ");
}

export function atsChecks(cv: CV, template: TemplateId): Check[] {
  const p = cv.personal;
  const bullets = [...cv.experience.flatMap((e) => clean(e.bullets)), ...cv.projects.flatMap((pr) => clean(pr.bullets))];
  const withNumbers = bullets.filter((b) => /\d/.test(b)).length;
  const withVerbs = bullets.filter((b) => {
    const first = b.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    return ACTION_VERBS.has(first) || /ed$/.test(first);
  }).length;
  const words = cvText(cv).split(/\s+/).filter(Boolean).length + [p.name, p.email].join(" ").split(/\s+/).length;
  const skillCount = cv.skills.flatMap((s) => s.items.split(/[,;\n]/)).filter((s) => s.trim()).length;
  const tpl = TEMPLATES.find((t) => t.id === template);

  const checks: Check[] = [
    tpl?.atsFriendly
      ? { label: "Layout", status: "ok", detail: `${tpl.name} template reads top to bottom in the right order.` }
      : {
          label: "Layout",
          status: "warn",
          detail: "Two-column layouts can be read out of order by some ATS. Use the ATS or Classic template for online applications.",
        },
    p.email.trim() && p.phone.trim()
      ? { label: "Contact details", status: "ok", detail: "Email and phone are in the header as plain text." }
      : { label: "Contact details", status: "warn", detail: "Add both an email and a phone number." },
    p.headline.trim()
      ? { label: "Job title", status: "ok", detail: `“${p.headline}” helps the ATS match you to the role.` }
      : { label: "Job title", status: "warn", detail: "Add the job title you are applying for." },
    cv.experience.length === 0 || cv.experience.every((e) => e.date.trim())
      ? { label: "Dates", status: "ok", detail: "Every job has dates." }
      : { label: "Dates", status: "warn", detail: "Add dates to every job (for example “Jan 2024 – Present”)." },
    bullets.length === 0
      ? { label: "Achievements", status: "warn", detail: "Add a few achievement lines to your jobs or projects." }
      : withVerbs / bullets.length >= 0.6
        ? { label: "Action verbs", status: "ok", detail: `${withVerbs} of ${bullets.length} lines start with an action verb.` }
        : { label: "Action verbs", status: "warn", detail: `Only ${withVerbs} of ${bullets.length} lines start with an action verb like Built, Led or Improved.` },
    bullets.length === 0
      ? null
      : withNumbers / bullets.length >= 0.3
        ? { label: "Measurable results", status: "ok", detail: `${withNumbers} lines include numbers.` }
        : { label: "Measurable results", status: "warn", detail: "Add numbers to more lines: users, %, time saved, team size." },
    skillCount >= 6
      ? { label: "Skills", status: "ok", detail: `${skillCount} skills listed as plain text.` }
      : { label: "Skills", status: "warn", detail: "List at least 6 relevant skills." },
    /\b(I|my|me)\b/.test(cv.summary)
      ? { label: "Summary style", status: "warn", detail: "Write the summary without “I” or “my”." }
      : { label: "Summary style", status: "ok", detail: "Summary is written without pronouns." },
    words < 200
      ? { label: "Length", status: "warn", detail: `About ${words} words. Most good CVs have 300–800.` }
      : words > 1100
        ? { label: "Length", status: "warn", detail: `About ${words} words. Try to cut it down to two pages.` }
        : { label: "Length", status: "ok", detail: `About ${words} words, a good length.` },
  ].filter((c): c is Check => c !== null);

  return checks;
}

/* ------------------------------------------------------------------ Keyword match */

const KNOWN_TERMS = (
  "JavaScript|TypeScript|Python|Java|C#|C++|Go|Golang|Rust|PHP|Ruby|Kotlin|Swift|Dart|Scala|SQL|NoSQL|GraphQL|REST|gRPC|" +
  "HTML|CSS|Sass|Tailwind|Tailwind CSS|Bootstrap|React|React Native|Next.js|Vue|Vue.js|Nuxt|Angular|Svelte|Redux|Zustand|" +
  "Node.js|Express|NestJS|Django|Flask|FastAPI|Spring|Spring Boot|Laravel|Rails|.NET|ASP.NET|" +
  "PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|SQLite|Firebase|Supabase|Prisma|DynamoDB|Convex|" +
  "AWS|Azure|GCP|Google Cloud|Docker|Kubernetes|Terraform|Ansible|Linux|Nginx|CI/CD|GitHub Actions|Jenkins|GitLab|Git|" +
  "RabbitMQ|Kafka|BullMQ|WebSockets|WebRTC|Socket.IO|Microservices|Serverless|" +
  "Jest|Cypress|Playwright|Selenium|Vitest|Testing Library|TDD|Unit testing|" +
  "Figma|UI/UX|Accessibility|Responsive design|SEO|" +
  "Machine learning|Deep learning|PyTorch|TensorFlow|NLP|LLM|LLMs|RAG|LangChain|LangGraph|OpenAI|Claude|Prompt engineering|AI agents|Vector database|pgvector|" +
  "Twilio|Vonage|Stripe|Shopify|Salesforce|HubSpot|Jira|Agile|Scrum|Kanban|" +
  "Data analysis|Power BI|Tableau|Excel|Pandas|NumPy|Spark|Airflow|dbt|Snowflake|BigQuery|ETL|" +
  "System design|API design|Database design|Performance optimization|Security|OAuth|JWT|" +
  "Communication|Leadership|Teamwork|Problem solving|Project management|Mentoring|Stakeholder management|Customer support"
).split("|");

const ALIASES: Record<string, string[]> = {
  "next.js": ["nextjs", "next js"],
  "node.js": ["nodejs", "node js", "node"],
  "vue.js": ["vuejs", "vue"],
  postgresql: ["postgres"],
  "ci/cd": ["ci cd", "continuous integration", "continuous delivery", "continuous deployment"],
  llm: ["llms", "large language model"],
  llms: ["llm", "large language model"],
  "tailwind css": ["tailwind"],
  tailwind: ["tailwind css"],
  "ui/ux": ["ui ux", "user experience", "ux"],
  "machine learning": ["ml"],
  "google cloud": ["gcp"],
  gcp: ["google cloud"],
  "ai agents": ["agents", "ai agent", "agentic"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Words that are also everyday English: only count them when written with a capital letter. */
const CASE_SENSITIVE = new Set(["Go", "Express", "Spring", "Excel", "Rust", "Swift", "Dart", "Ruby", "Rails", "Security", "Kanban", "Communication", "Leadership", "Teamwork"]);

function contains(haystack: string, term: string): boolean {
  const variants = [term, ...(ALIASES[term.toLowerCase()] ?? [])];
  const flags = CASE_SENSITIVE.has(term) ? "" : "i";
  return variants.some((v) =>
    new RegExp(`(^|[^A-Za-z0-9])${escape(flags ? v.toLowerCase() : v)}($|[^A-Za-z0-9+#])`, flags).test(haystack),
  );
}

export type KeywordResult = { matched: string[]; missing: string[]; score: number };

/** Finds the known skills and tools named in a job advert and checks which ones the CV mentions. */
export function keywordMatch(cv: CV, jobAd: string): KeywordResult {
  const ad = jobAd;
  const text = cvText(cv);
  const found: string[] = [];
  for (const term of KNOWN_TERMS) {
    if (!contains(ad, term)) continue;
    // Skip a shorter term when a longer one containing it is already listed (e.g. "React" vs "React Native").
    if (found.some((f) => f.toLowerCase() === term.toLowerCase())) continue;
    found.push(term);
  }
  const unique = found.filter(
    (t, i) =>
      !found.some(
        (o, j) => j !== i && o.length > t.length && o.toLowerCase().includes(t.toLowerCase()) && !contains(ad.split(o).join(" "), t),
      ),
  );
  const matched = unique.filter((t) => contains(text, t));
  const missing = unique.filter((t) => !contains(text, t));
  return { matched, missing, score: unique.length ? Math.round((matched.length / unique.length) * 100) : 0 };
}
