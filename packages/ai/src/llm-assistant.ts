import { cleanLine, cvText, guardNumbers, newId, normalizeCV, type CV } from "@cvb/domain";
import { z } from "zod";
import {
  AiOutputError,
  type AnswerFeedback,
  type Assistant,
  type ChatMessage,
  type InterviewQuestion,
  type JobInput,
  type LetterDraft,
  type LetterLength,
  type LetterTone,
  type ModelTier,
  type RewriteMode,
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
});
const Star = z.object({ situation: z.string(), task: z.string(), action: z.string(), result: z.string() });
const Brief = z.object({ questionsToAsk: z.array(z.string()).min(1), themes: z.array(z.string()) });

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

/** The Assistant backed by a language model (Claude in production). */
export class LlmAssistant implements Assistant {
  readonly name = "llm";

  constructor(private readonly model: TextModel) {}

  /** Asks for JSON, validates it, and retries once with the error if it doesn't parse. */
  private async json<T>(schema: z.ZodType<T>, prompt: string, tier: ModelTier, maxTokens: number): Promise<T> {
    const messages: ChatMessage[] = [{ role: "user", content: `${prompt}\n\n${JSON_RULE}` }];
    for (let attempt = 0; attempt < 2; attempt++) {
      const reply = await this.model.complete({ system: AI_PRINCIPLES, messages, tier, maxTokens });
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

  async writeSummary({ cv, targetTitle }: { cv: CV; targetTitle?: string }) {
    const out = await this.json(
      Options,
      `Write 2 alternative CV summaries (3-4 sentences, 45-80 words each, no "I") for this person${targetTitle ? `, aimed at a ${targetTitle} role` : ""}.
Use only facts from the CV.
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
Question: """${question}"""
Answer: """${answer.slice(0, 4000)}"""
Return {"scores": {"structure": 1-5, "relevance": 1-5, "clarity": 1-5}, "feedback": "...", "improved": "..."}.`,
      "smart",
      1200,
    );
    return {
      scores: { structure: clamp(out.scores.structure), relevance: clamp(out.scores.relevance), clarity: clamp(out.scores.clarity) },
      feedback: out.feedback.trim(),
      improved: guardNumbers(out.improved.trim(), answer),
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
}

/** Exposed for tests. */
export const _schemas = { Options, Tailored, Letter };
export type { JobInput, LetterLength, LetterTone };
