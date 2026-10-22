import { cleanLine, cvText, groundCv, guardNumbers, isLinkedInPdfText, LINKEDIN_LIMITS, newId, normalizeCV, parseLinkedInPdfText, parseResumeText, splitList, type CV } from "@cvb/domain";
import { z } from "zod";
import { finishLinkedInProfile } from "./linkedin";
import {
  AiOutputError,
  type AnswerFeedback,
  type Assistant,
  type ChatMessage,
  type InterviewQuestion,
  type JobInput,
  type LetterDraft,
  type LinkedInProfile,
  type LetterLength,
  type LetterTone,
  type ModelTier,
  type RewriteMode,
  type SkillGroupInput,
  type StarStory,
  type TextModel,
} from "./types";

/** The rules every prompt carries (scope §7.4). */
export const AI_PRINCIPLES = `You help job seekers write CVs, cover letters and interview answers.
Rules you never break:
- Never invent employers, job titles, dates, degrees, certifications, tools or numbers. Use only facts given to you.
- When a stronger line needs a number the person didn't give, write a placeholder in square brackets such as [number], [%] or [time saved] for them to fill in.
- Keep the person's language variety (British or American spelling) and keep it professional and plain.
- No buzzword padding, no clichés like "results-driven", "synergy", "go-getter".
- Follow the requested output format exactly.`;

const JSON_RULE = "Reply with JSON only, no prose, no code fences.";

/** Pulls the first JSON object out of a model reply. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiOutputError();
  return JSON.parse(text.slice(start, end + 1));
}

/** A CV as plain text for prompts (ids included where edits must map back). */
export function cvForPrompt(cv: CV, withIds = false): string {
  const p = cv.personal;
  const id = (x: { id: string }) => (withIds ? ` [id=${x.id}]` : "");
  const lines = [
    `Name: ${p.name}`,
    `Headline: ${p.headline}`,
    p.tagline && `Key skills line: ${p.tagline}`,
    `Summary: ${cv.summary}`,
    "Experience:",
    ...cv.experience.flatMap((e) => [
      `- ${e.role} at ${e.company} (${e.date})${id(e)}`,
      ...e.bullets.filter((b) => b.trim()).map((b) => `  • ${b}`),
      e.stack && `  Tools: ${e.stack}`,
    ]),
    cv.projects.length ? "Projects:" : "",
    ...cv.projects.flatMap((pr) => [`- ${pr.name} (${pr.date})${id(pr)}`, ...pr.bullets.filter((b) => b.trim()).map((b) => `  • ${b}`), pr.stack && `  Tools: ${pr.stack}`]),
    "Skills:",
    ...cv.skills.map((s) => `- ${s.category}: ${s.items}${id(s)}`),
    "Education:",
    ...cv.education.map((e) => `- ${e.degree}, ${e.school} (${e.date}) ${e.details}`),
    cv.certificates.length ? `Certificates: ${cv.certificates.map((c) => c.name).join("; ")}` : "",
    cv.languages.length ? `Languages: ${cv.languages.map((l) => `${l.name} ${l.level}`).join("; ")}` : "",
  ];
  return lines.filter((l): l is string => Boolean(l && String(l).trim())).join("\n");
}

const REWRITE: Record<RewriteMode, string> = {
  grammar: "Fix grammar, spelling and punctuation only. Keep wording and meaning.",
  shorter: "Make it about 30% shorter without losing any fact.",
  formal: "Make the tone more formal and professional.",
  confident: "Make it sound more confident and direct: active voice, strong verbs, no hedging.",
};

const LENGTH_WORDS: Record<LetterLength, string> = { short: "150-200", medium: "250-320", long: "350-450" };

const Options = z.object({ options: z.array(z.string().min(3)).min(1).max(5) });
const Skills = z.object({ skills: z.array(z.string().min(1).max(60)).max(30) });
const Text = z.object({ text: z.string().min(1) });
const Tailored = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
  experience: z.array(z.object({ id: z.string(), bullets: z.array(z.string()) })).optional(),
  projects: z.array(z.object({ id: z.string(), bullets: z.array(z.string()) })).optional(),
  skills: z.array(z.object({ id: z.string().nullish(), category: z.string(), items: z.string() })).optional(),
  notes: z.array(z.string()).optional(),
});
const Letter = z.object({ greeting: z.string(), paragraphs: z.array(z.string()).min(2).max(6), closing: z.string() });
const Questions = z.object({
  questions: z.array(z.object({ question: z.string(), competency: z.string(), tip: z.string() })).min(1),
});
const Feedback = z.object({
  scores: z.object({ structure: z.number(), relevance: z.number(), clarity: z.number() }),
  feedback: z.string(),
  improved: z.string(),
  followUp: z.string().nullable().optional(),
});
const Star = z.object({ situation: z.string(), task: z.string(), action: z.string(), result: z.string() });
const Brief = z.object({ questionsToAsk: z.array(z.string()).min(1), themes: z.array(z.string()) });

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

/** The JSON Schema of a zod shape, for models that enforce structured output; undefined if it can't be expressed. */
function jsonSchema(schema: z.ZodType): Record<string, unknown> | undefined {
  try {
    return z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

const s = z.string();
/** What reading a CV returns. Every field is required so small models fill the whole shape. */
const ParsedCvShape = z.object({
  personal: z.object({ name: s, headline: s, email: s, phone: s, location: s, website: s, linkedin: s, github: s }),
  summary: s,
  experience: z.array(z.object({ role: s, company: s, location: s, date: s, bullets: z.array(s), stack: s })),
  education: z.array(z.object({ degree: s, school: s, date: s, details: s })),
  skills: z.array(z.object({ category: s, items: s })),
  projects: z.array(z.object({ name: s, date: s, links: z.array(s), bullets: z.array(s), stack: s })),
  certificates: z.array(z.object({ name: s, issuer: s, year: s })),
  languages: z.array(z.object({ name: s, level: s })),
});

const PARSE_SYSTEM = `You convert the text of a CV (resume) into JSON for a CV editor.
- Copy the person's own wording exactly. Do not rewrite, summarise, translate or correct anything.
- Every job, project and degree is a separate item. Each achievement or responsibility line is a separate bullet, without the bullet symbol.
- "date" keeps the dates as written, e.g. "Oct 2025 – Present".
- "headline" is the job title under the name, if there is one. "summary" is the profile / about / summary paragraph.
- Skills: keep the CV's own groups (category + comma-separated items). If the CV has no groups, use one category "Skills".
- "stack" is filled only when the CV lists tools for that specific job or project ("Stack: …", "Tools: …").
- Spoken languages (English, Urdu, Arabic…) go in "languages", never in skills.
- Use "" or [] for anything the CV doesn't contain. Never invent anything.`;

/** ATS keywords from a job advert: use the advert's wording only where the person's facts already support it. */
const keywordRule = (keywords: string[]) =>
  `Job advert keywords: ${keywords.slice(0, 20).join(", ")}. Where the facts given already support one of these, use the advert's exact wording (ATS systems match words). Never add a keyword the facts don't support.`;

const Bullets = z.object({ bullets: z.array(z.string()).min(1).max(10) });
const LinkedIn = z.object({
  headline: z.string().min(3),
  headlineOptions: z.array(z.string()).max(5),
  about: z.array(z.string()).min(1).max(5),
  experience: z.array(z.object({ id: z.string(), description: z.string() })),
  skills: z.array(z.string()).max(10),
});
const Groups = z.object({ groups: z.array(z.object({ category: z.string(), skills: z.array(z.string()) })).min(1).max(12) });

/** The Assistant backed by a language model (Claude in production, or a local Ollama model). */
export class LlmAssistant implements Assistant {
  constructor(
    private readonly model: TextModel,
    readonly name = "llm",
  ) {}

  /** Asks for JSON, validates it, and retries once with the error if it doesn't parse. */
  private async json<T>(schema: z.ZodType<T>, prompt: string, tier: ModelTier, maxTokens: number, system = AI_PRINCIPLES): Promise<T> {
    const messages: ChatMessage[] = [{ role: "user", content: `${prompt}\n\n${JSON_RULE}` }];
    for (let attempt = 0; attempt < 2; attempt++) {
      const reply = await this.model.complete({ system, messages, tier, maxTokens, json: true, schema: jsonSchema(schema) });
      try {
        return schema.parse(extractJson(reply));
      } catch (e) {
        messages.push({ role: "assistant", content: reply }, { role: "user", content: `That wasn't valid: ${String(e).slice(0, 200)}. ${JSON_RULE}` });
      }
    }
    throw new AiOutputError();
  }

  async improveBullet({ bullet, role, company }: { bullet: string; role?: string; company?: string }) {
    const out = await this.json(
      Options,
      `Rewrite this CV line as an achievement. Give 3 different options, each one line, starting with a strong past-tense action verb.
Context: ${[role, company].filter(Boolean).join(" at ") || "not given"}.
Line: """${bullet}"""
Return {"options": ["...", "...", "..."]}.`,
      "fast",
      400,
    );
    return { options: out.options.slice(0, 3).map((o) => guardNumbers(cleanLine(o), `${bullet} ${role ?? ""} ${company ?? ""}`)) };
  }

  async writeSummary({ cv, targetTitle, keywords }: { cv: CV; targetTitle?: string; keywords?: string[] }) {
    const out = await this.json(
      Options,
      `Write 2 alternative CV summaries (3-4 sentences, 45-80 words each, no "I") for this person${targetTitle ? `, aimed at a ${targetTitle} role` : ""}.
Use only facts from the CV.${keywords?.length ? `\n${keywordRule(keywords)}` : ""}
CV:
${cvForPrompt(cv)}
Return {"options": ["...", "..."]}.`,
      "fast",
      600,
    );
    const source = cvText(cv);
    return { options: out.options.slice(0, 2).map((o) => guardNumbers(o.trim(), source)) };
  }

  async rewrite({ text, mode }: { text: string; mode: RewriteMode }) {
    const out = await this.json(Text, `${REWRITE[mode]}\nText: """${text}"""\nReturn {"text": "..."}.`, "fast", 800);
    return { text: guardNumbers(out.text.trim(), text) };
  }

  async suggestSkills({ cv, targetTitle }: { cv: CV; targetTitle?: string }) {
    const out = await this.json(
      Skills,
      `Suggest up to 12 skills this person likely has and that employers search for${targetTitle ? ` in ${targetTitle} roles` : ""}, based on their experience and tools.
Do not repeat skills already listed. Prefer concrete tools and methods over soft skills.
CV:
${cvForPrompt(cv)}
Return {"skills": ["..."]}.`,
      "fast",
      300,
    );
    const have = cvText(cv);
    return { skills: [...new Set(out.skills.map((s) => s.trim()))].filter((s) => s && !have.includes(s.toLowerCase())).slice(0, 12) };
  }

  async tailor({ cv, job, missing }: { cv: CV; job: JobInput; missing: string[] }) {
    const out = await this.json(
      Tailored,
      `Tailor this CV to the job below. Change only: headline, summary, achievement lines (keep each entry's id) and skills.
Bring the most relevant achievements first, use the job's wording where the person's real experience supports it, and add missing keywords only where the CV already shows that skill.
Do not add skills or tools the CV gives no evidence of; list those under "notes" as things to add if true.
Job: ${job.title} at ${job.company}
Missing keywords: ${missing.join(", ") || "none"}
Job description:
"""${job.description.slice(0, 6000)}"""
CV:
${cvForPrompt(cv, true)}
Return {"headline": "...", "summary": "...", "experience": [{"id": "...", "bullets": ["..."]}], "projects": [{"id": "...", "bullets": ["..."]}], "skills": [{"id": "... or null for a new group", "category": "...", "items": "comma, separated"}], "notes": ["..."]}.`,
      "smart",
      3000,
    );
    const source = cvText(cv);
    const guard = (s: string) => guardNumbers(cleanLine(s), source);
    const next = structuredClone(cv);
    if (out.headline?.trim()) next.personal.headline = out.headline.trim();
    if (out.summary?.trim()) next.summary = guardNumbers(out.summary.trim(), source);
    for (const e of out.experience ?? []) {
      const item = next.experience.find((x) => x.id === e.id);
      if (item && e.bullets.length) item.bullets = e.bullets.map(guard).filter(Boolean);
    }
    for (const p of out.projects ?? []) {
      const item = next.projects.find((x) => x.id === p.id);
      if (item && p.bullets.length) item.bullets = p.bullets.map(guard).filter(Boolean);
    }
    for (const s of out.skills ?? []) {
      const item = s.id ? next.skills.find((x) => x.id === s.id) : undefined;
      if (item) item.items = s.items;
      else if (s.items.trim()) next.skills.push({ id: newId("skill"), category: s.category, items: s.items });
    }
    return { cv: normalizeCV(next), notes: out.notes ?? [] };
  }

  async coverLetter({ cv, job, tone, length }: { cv: CV; job: JobInput; tone: LetterTone; length: LetterLength }): Promise<LetterDraft> {
    const out = await this.json(
      Letter,
      `Write a ${tone} cover letter of ${LENGTH_WORDS[length]} words for ${cv.personal.name || "the applicant"} applying for ${job.title} at ${job.company}.
Use the person's real experience from the CV and name the company and role. Open with why this role, then 1-2 paragraphs linking real achievements to the job's needs, then a short close.
Job description:
"""${job.description.slice(0, 5000)}"""
CV:
${cvForPrompt(cv)}
Return {"greeting": "Dear ...,", "paragraphs": ["...", "..."], "closing": "Kind regards,"}.`,
      "smart",
      1500,
    );
    const source = `${cvText(cv)} ${job.description}`;
    return { greeting: out.greeting.trim(), paragraphs: out.paragraphs.map((p) => guardNumbers(p.trim(), source)), closing: out.closing.trim() };
  }

  async interviewQuestions({ role, seniority, description, count }: { role: string; seniority?: string; description?: string; count: number }) {
    const out = await this.json(
      Questions,
      `Write ${count} interview questions for a ${seniority ? `${seniority} ` : ""}${role} candidate: a mix of behavioural, role-specific technical and situational.
${description ? `Job description:\n"""${description.slice(0, 4000)}"""` : ""}
For each give the competency it tests and a one-sentence tip on what a strong answer covers.
Return {"questions": [{"question": "...", "competency": "...", "tip": "..."}]}.`,
      "fast",
      1800,
    );
    return { questions: out.questions.slice(0, count) as InterviewQuestion[] };
  }

  async interviewFeedback({ role, question, answer }: { role: string; question: string; answer: string }): Promise<AnswerFeedback> {
    const out = await this.json(
      Feedback,
      `You are an interviewer for a ${role} role. Score this answer from 1 to 5 on structure (situation, task, action, result), relevance to the question, and clarity.
Give 2-3 sentences of specific feedback, then a stronger version of the answer that uses only facts from the candidate's answer (placeholders in [brackets] for anything missing).
If something important is missing or vague (their own actions, the result, a number), add one short follow-up question a real interviewer would ask next; otherwise null.
Question: """${question}"""
Answer: """${answer.slice(0, 4000)}"""
Return {"scores": {"structure": 1-5, "relevance": 1-5, "clarity": 1-5}, "feedback": "...", "improved": "...", "followUp": "..." or null}.`,
      "smart",
      1200,
    );
    return {
      scores: { structure: clamp(out.scores.structure), relevance: clamp(out.scores.relevance), clarity: clamp(out.scores.clarity) },
      feedback: out.feedback.trim(),
      improved: guardNumbers(out.improved.trim(), answer),
      followUp: out.followUp?.trim() ? out.followUp.trim().slice(0, 300) : null,
    };
  }

  async starStory({ bullet, role, company }: { bullet: string; role: string; company: string }): Promise<StarStory> {
    const out = await this.json(
      Star,
      `Turn this CV achievement into a STAR interview story (Situation, Task, Action, Result), 1-3 sentences each, first person.
Use only the facts given; put [details] where the person must add specifics.
Role: ${role} at ${company}
Achievement: """${bullet}"""
Return {"situation": "...", "task": "...", "action": "...", "result": "..."}.`,
      "fast",
      700,
    );
    const g = (s: string) => guardNumbers(s.trim(), `${bullet} ${role} ${company}`);
    return { situation: g(out.situation), task: g(out.task), action: g(out.action), result: g(out.result) };
  }

  async companyBrief({ company, role, description }: { company: string; role: string; description?: string }) {
    const out = await this.json(
      Brief,
      `Help a candidate prepare to interview with ${company} for a ${role} role. You have no browsing: base everything on the job description below and general knowledge of roles like this, and do not state facts about the company you aren't sure of.
${description ? `Job description:\n"""${description.slice(0, 4000)}"""` : ""}
Give 5 thoughtful questions the candidate could ask, and 3-5 themes to research or prepare for.
Return {"questionsToAsk": ["..."], "themes": ["..."]}.`,
      "fast",
      700,
    );
    return { questionsToAsk: out.questionsToAsk.slice(0, 6), themes: out.themes.slice(0, 6) };
  }
  async parseCv({ text }: { text: string }) {
    const source = text.slice(0, 16_000);
    const out = await this.json(ParsedCvShape, `CV text:\n"""\n${source}\n"""`, "smart", 6000, PARSE_SYSTEM);
    const fallback = (isLinkedInPdfText(source) ? parseLinkedInPdfText(source) : parseResumeText(source)).cv;
    const { cv } = groundCv(normalizeCV(out), source, fallback);
    // Sections the model missed but the rule-based reading found are taken from it.
    for (const key of ["experience", "education", "projects", "skills", "certificates", "languages"] as const) {
      if (!cv[key].length && fallback[key].length) (cv[key] as unknown[]) = fallback[key];
    }
    if (!cv.summary && fallback.summary) cv.summary = fallback.summary;
    return { cv };
  }

  async improveEntry({ kind, title, organisation, bullets, notes, stack, targetTitle, keywords }: { kind: "experience" | "project"; title: string; organisation?: string; bullets: string[]; notes?: string; stack?: string; targetTitle?: string; keywords?: string[] }) {
    const lines = bullets.map((b) => b.trim()).filter(Boolean);
    const what = kind === "experience" ? `Job: ${title}${organisation ? ` at ${organisation}` : ""}` : `Project: ${title}`;
    const context = [what, stack && `Tools: ${stack}`, targetTitle && `Target job: ${targetTitle}`, keywords?.length && keywordRule(keywords)].filter(Boolean).join("\n");
    const task = lines.length
      ? `Rewrite these CV lines as strong achievement lines for an ATS-friendly CV. Keep every fact and every number exactly; do not add facts. Keep about the same number of lines (${lines.length}); merge duplicates, split lines that hold two achievements.
Each line: starts with a past-tense action verb (Built, Led, Designed, Reduced…), one sentence, under 30 words, no "I", no full stop at the end, plain words recruiters search for.
Where a result would need a number the person didn't give, add a placeholder like [number] or [%].

${context}
Lines:
${lines.map((l) => `- ${l}`).join("\n")}`
      : `Write 3 to 5 achievement lines for this ${kind === "experience" ? "job" : "project"} for an ATS-friendly CV, using only the facts in the notes.
Each line: starts with a past-tense action verb, one sentence, under 30 words, no "I", no full stop at the end. Use placeholders like [number] or [%] where a result needs a number the notes don't give. Never invent tools, employers or results.

${context}
Notes: """${(notes ?? "").slice(0, 3000)}"""`;
    const out = await this.json(Bullets, `${task}\n\nReply as {"bullets": ["…", "…"]}.`, "fast", 900);
    const source = [title, organisation, stack, notes, ...lines].filter(Boolean).join("\n");
    const seen = new Set<string>();
    const result = out.bullets
      .map((b) => guardNumbers(cleanLine(b).replace(/\.$/, ""), source).slice(0, 260))
      .filter((b) => b.length > 3 && !seen.has(b.toLowerCase()) && seen.add(b.toLowerCase()));
    if (!result.length) throw new AiOutputError();
    return { bullets: result };
  }

  async linkedinProfile({ cv, targetTitle }: { cv: CV; targetTitle?: string }): Promise<LinkedInProfile> {
    const L = LINKEDIN_LIMITS;
    const out = await this.json(
      LinkedIn,
      `Write this person's LinkedIn profile from their CV${targetTitle ? `, aimed at ${targetTitle} roles` : ""}. Use only facts from the CV.
- "headline": at most ${L.headline} characters: their role and the 2-3 skills or areas recruiters search for, separated by " | ". No emoji, no hashtags.
- "headlineOptions": ${L.headlineOptions} different alternative headlines, each at most ${L.headline} characters.
- "about": exactly 3 short paragraphs in the first person ("I…"), together at most ${L.about} characters: who they are and what they do; their strongest achievements from the CV; what they work with and what they're open to (use a placeholder like [the roles you're looking for] if the CV doesn't say).
- "experience": one item per job, with the job's id, and a "description" of at most ${L.experience} characters: one short opening sentence, then the achievements as lines starting with "• ". Keep every fact and number exactly as in the CV.
- "skills": the ${L.skills} skills from the CV that matter most for their target roles, spelled as on the CV.
Never add employers, titles, dates, tools, skills or numbers that aren't in the CV; where a line would need a number they didn't give, write [number] or [%].
CV:
${cvForPrompt(cv, true)}
Return {"headline": "...", "headlineOptions": ["...", "...", "..."], "about": ["...", "...", "..."], "experience": [{"id": "...", "description": "..."}], "skills": ["..."]}.`,
      "smart",
      3500,
    );
    const source = cvForPrompt(cv);
    return finishLinkedInProfile(
      { headline: out.headline, headlineOptions: out.headlineOptions, about: out.about.map((p) => p.trim()).filter(Boolean).join("\n\n"), experience: out.experience.map((e) => ({ ...e, role: "", company: "" })), skills: out.skills },
      cv,
      (text) => guardNumbers(text, source),
      targetTitle,
    );
  }

  async organiseSkills({ skills, extra, targetTitle }: { skills: SkillGroupInput[]; extra?: string; targetTitle?: string }) {
    const all = [...skills.flatMap((g) => splitList(g.items)), ...splitList(extra ?? "")];
    const byKey = new Map<string, string>();
    for (const item of all) if (!byKey.has(item.toLowerCase())) byKey.set(item.toLowerCase(), item);
    if (byKey.size === 0) return { skills: [] };
    const out = await this.json(
      Groups,
      `Group these skills for a CV into 3 to 8 categories with short, standard names (e.g. "Frontend", "Backend", "Databases", "Cloud & DevOps", "Tools", "Soft skills").
Use only the skills listed, spelled exactly as given. Put every skill in exactly one category. Put the categories and skills most relevant to the target job first.
${targetTitle ? `Target job: ${targetTitle}\n` : ""}Current groups (for reference): ${skills.map((g) => g.category).filter(Boolean).join(", ") || "none"}
Skills: ${[...byKey.values()].join(", ")}

Reply as {"groups": [{"category": "…", "skills": ["…"]}]}.`,
      "fast",
      1200,
    );
    const used = new Set<string>();
    const groups = out.groups
      .map((g) => ({
        category: cleanLine(g.category).slice(0, 40) || "Skills",
        items: g.skills
          .map((x) => byKey.get(x.trim().toLowerCase()))
          .filter((x): x is string => Boolean(x) && !used.has(x!.toLowerCase()) && Boolean(used.add(x!.toLowerCase())))
          .join(", "),
      }))
      .filter((g) => g.items);
    const missed = [...byKey.values()].filter((x) => !used.has(x.toLowerCase()));
    if (missed.length) groups.push({ category: "Other", items: missed.join(", ") });
    return { skills: groups };
  }
}

/** Exposed for tests. */
export const _schemas = { Options, Tailored, Letter };
export type { JobInput, LetterLength, LetterTone };
