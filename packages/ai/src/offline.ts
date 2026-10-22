import { ACTION_VERBS, addKeyword, clean, cvText, isLinkedInPdfText, isQuantified, newId, parseLinkedInPdfText, parseResumeText, splitList, type CV } from "@cvb/domain";
import { draftLinkedInProfile } from "./linkedin";
import type {
  AnswerFeedback,
  Assistant,
  InterviewQuestion,
  JobInput,
  LetterDraft,
  LetterLength,
  LetterTone,
  LinkedInProfile,
  RewriteMode,
  SkillGroupInput,
  StarStory,
} from "./types";

/**
 * A deterministic stand-in used when no AI key is configured (local development, tests, demos).
 * It follows the same rules as the real assistant: it only rearranges what the person wrote
 * and uses placeholders instead of inventing facts.
 */

const WEAK = /^(responsible for|duties included|tasked with|worked on|helped( to)?|involved in|in charge of|assisted (with|in))\s+/i;
const VERBS = ["Led", "Delivered", "Improved"];

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ").replace(/[.;]+$/, "");
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
};

const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

const PAST: Record<string, string> = {
  build: "built", lead: "led", write: "wrote", make: "made", run: "ran", set: "set", drive: "drove", grow: "grew", win: "won", teach: "taught",
  manage: "managed", maintain: "maintained", design: "designed", create: "created", develop: "developed", implement: "implemented",
  improve: "improved", own: "owned", ship: "shipped", launch: "launched", migrate: "migrated", automate: "automated", reduce: "reduced",
  increase: "increased", deliver: "delivered", handle: "handled", support: "supported", coordinate: "coordinated", test: "tested",
  deploy: "deployed", integrate: "integrated", analyse: "analysed", analyze: "analyzed", mentor: "mentored", organise: "organised",
  organize: "organized", plan: "planned", research: "researched", train: "trained", optimise: "optimised", optimize: "optimized", use: "used",
};
const past = (w: string) => PAST[w.toLowerCase()] ?? (/^[a-z]+ed$/i.test(w) ? w.toLowerCase() : null);

/** "build and maintain a platform" → "built and maintained a platform"; null if it doesn't start with a verb. */
function toPast(core: string): string | null {
  const words = core.split(/\s+/);
  const first = past(words[0] ?? "");
  if (!first) return null;
  words[0] = first;
  if (words[1]?.toLowerCase() === "and" && words[2] && past(words[2])) words[2] = past(words[2])!;
  return words.join(" ");
}

function asAchievement(bullet: string, verb: string): string {
  const core = bullet.trim().replace(WEAK, "").replace(/[.;]+$/, "");
  const first = core.split(/\s+/)[0]?.toLowerCase() ?? "";
  const rest = ACTION_VERBS.has(first) ? core.split(/\s+/).slice(1).join(" ") : core;
  return sentence(`${verb} ${lowerFirst(rest)}`);
}

const WORDS: Record<LetterLength, number> = { short: 1, medium: 2, long: 3 };

export class OfflineAssistant implements Assistant {
  readonly name = "offline";

  async improveBullet({ bullet }: { bullet: string }) {
    const quantified = isQuantified(bullet);
    const core = bullet.trim().replace(WEAK, "").replace(/[.;]+$/, "");
    const asPast = toPast(core);
    if (asPast) {
      const base = sentence(asPast);
      return {
        options: [
          base + (quantified ? "" : ", used by [number] people"),
          base + (quantified ? ", on time and within scope" : ", cutting [task] time by [%]"),
          sentence(`Took ownership: ${asPast}`) + (quantified ? "" : ", with [result]"),
        ],
      };
    }
    return {
      options: [
        asAchievement(bullet, VERBS[0]!),
        asAchievement(bullet, VERBS[1]!) + (quantified ? "" : ", reaching [number] users"),
        asAchievement(bullet, VERBS[2]!) + (quantified ? "" : " by [%]"),
      ],
    };
  }

  async writeSummary({ cv, targetTitle }: { cv: CV; targetTitle?: string }) {
    const title = targetTitle || cv.personal.headline || cv.experience[0]?.role || "Professional";
    const skills = cv.skills.flatMap((s) => s.items.split(/\s*,\s*/)).filter(Boolean).slice(0, 4);
    const recent = cv.experience[0];
    const a = [
      `${title} with hands-on experience${recent ? ` as ${recent.role} at ${recent.company}` : ""}.`,
      skills.length ? `Works with ${skills.join(", ")}.` : "",
      clean(recent?.bullets ?? [])[0] ? `Recently ${lowerFirst(clean(recent!.bullets)[0]!.replace(/[.]$/, ""))}.` : "",
      "Known for clear communication and reliable delivery.",
    ];
    const b = [
      `${title} focused on ${skills.slice(0, 2).join(" and ") || "[your main skills]"}.`,
      recent ? `Most recently at ${recent.company}, where the work covered ${lowerFirst(clean(recent.bullets)[0]?.replace(/[.]$/, "") ?? "[key responsibility]")}.` : "",
      "Looking to bring [strength] to a team that values [what you care about].",
    ];
    return { options: [a, b].map((x) => x.filter(Boolean).join(" ")) };
  }

  async rewrite({ text, mode }: { text: string; mode: RewriteMode }) {
    let out = text.trim().replace(/\s+/g, " ").replace(/\bi\b/g, "I").replace(/\s+([,.;])/g, "$1");
    if (mode === "shorter") out = out.split(/(?<=[.!?])\s+/).slice(0, Math.max(1, Math.ceil(out.split(/(?<=[.!?])\s+/).length * 0.7))).join(" ");
    if (mode === "confident") out = out.replace(/\b(I think|I believe|maybe|perhaps|somewhat|helped to|tried to)\s*/gi, "");
    if (mode === "formal") out = out.replace(/\bcan't\b/gi, "cannot").replace(/\bdon't\b/gi, "do not").replace(/\bI'm\b/g, "I am");
    return { text: sentence(out) + (/[.!?]$/.test(out) ? "" : ".") };
  }

  async suggestSkills({ cv }: { cv: CV; targetTitle?: string }) {
    const have = cvText(cv);
    const pool = ["Git", "Agile", "Unit testing", "CI/CD", "Code review", "Documentation", "REST APIs", "SQL", "Stakeholder communication", "Problem solving"];
    return { skills: pool.filter((s) => !have.includes(s.toLowerCase())).slice(0, 8) };
  }

  async tailor({ cv, job, missing }: { cv: CV; job: JobInput; missing: string[] }) {
    let next = structuredClone(cv);
    if (job.title) next.personal.headline = job.title;
    const have = cvText(cv);
    const supported = missing.filter((k) => have.includes(k.toLowerCase()));
    for (const k of supported) next = addKeyword(next, k, () => newId("skill"));
    if (next.summary && job.company && !next.summary.includes(job.company)) {
      next.summary = `${next.summary.trim()} Keen to bring this experience to ${job.company}.`;
    }
    const unsupported = missing.filter((k) => !supported.includes(k));
    return {
      cv: next,
      notes: unsupported.length ? [`Add these only if you have used them: ${unsupported.join(", ")}.`] : [],
    };
  }

  async coverLetter({ cv, job, tone, length }: { cv: CV; job: JobInput; tone: LetterTone; length: LetterLength }): Promise<LetterDraft> {
    const recent = cv.experience[0];
    const wins = cv.experience.flatMap((e) => clean(e.bullets).slice(0, 1).map((b) => `${lowerFirst(b.replace(/[.]$/, ""))} at ${e.company}`));
    const paragraphs = [
      `I am applying for the ${job.title} role at ${job.company}. ${recent ? `As ${recent.role} at ${recent.company}, I have` : "I have"} built the kind of experience this role asks for.`,
      wins.length ? `Highlights include: ${wins.slice(0, WORDS[length] + 1).join("; ")}.` : "In my recent work I have [your strongest achievement].",
      `I would welcome the chance to discuss how I can help ${job.company}. Thank you for your time.`,
    ];
    return {
      greeting: tone === "warm" ? `Hello ${job.company} team,` : "Dear Hiring Manager,",
      paragraphs: tone === "concise" ? [paragraphs[0]!, paragraphs[2]!] : paragraphs,
      closing: tone === "formal" ? "Yours sincerely," : "Kind regards,",
    };
  }

  async interviewQuestions({ role, count }: { role: string; count: number }) {
    const bank: InterviewQuestion[] = [
      { question: `Tell me about yourself and why you want this ${role} role.`, competency: "Motivation", tip: "Keep it to two minutes: past, present, why this role." },
      { question: "Describe a project you are proud of. What was your part?", competency: "Impact", tip: "Name your actions and a measurable result." },
      { question: "Tell me about a time you disagreed with a colleague.", competency: "Collaboration", tip: "Show how you listened and what you agreed." },
      { question: "Describe a mistake you made and what you learned.", competency: "Self-awareness", tip: "Own it, fix it, show the lesson applied later." },
      { question: "How do you prioritise when everything is urgent?", competency: "Prioritisation", tip: "Give your method and a real example." },
      { question: `What would you do in your first 90 days as a ${role}?`, competency: "Planning", tip: "Learn, quick win, then a bigger goal." },
      { question: "Tell me about a time you had to learn something quickly.", competency: "Learning", tip: "Explain how you learned and the outcome." },
      { question: "Describe a time you improved a process.", competency: "Ownership", tip: "Before, what you changed, after." },
      { question: "How do you handle feedback you disagree with?", competency: "Coachability", tip: "Show openness and how you resolved it." },
      { question: "Why should we hire you?", competency: "Fit", tip: "Three strengths tied to the job's needs." },
    ];
    return { questions: bank.slice(0, Math.max(1, Math.min(count, bank.length))) };
  }

  async interviewFeedback({ answer }: { role: string; question: string; answer: string }): Promise<AnswerFeedback> {
    const words = answer.trim().split(/\s+/).filter(Boolean).length;
    const hasResult = /\b(result|so that|which led|increased|reduced|saved|improved|delivered)\b/i.test(answer) || isQuantified(answer);
    const hasAction = /\b(I|we) (built|led|wrote|designed|decided|created|organised|organized|fixed|talked|proposed)\b/i.test(answer);
    const structure = 1 + (words > 40 ? 1 : 0) + (hasAction ? 1 : 0) + (hasResult ? 2 : 0);
    const clarity = words < 20 ? 2 : words > 350 ? 3 : 4;
    const relevance = words < 15 ? 2 : 4;
    return {
      scores: { structure: Math.min(5, structure), relevance, clarity },
      feedback: [
        hasAction ? "Good: you describe what you did yourself." : "Say clearly what you personally did (\"I built…\", not \"we\").",
        hasResult ? "You close with a result, which interviewers look for." : "End with the result, ideally with a number.",
        words > 350 ? "It's long; aim for about two minutes." : words < 40 ? "Add the situation and task so the story makes sense." : "Length is about right.",
      ].join(" "),
      improved: `Situation: [where and when]. Task: [what you had to achieve]. Action: ${answer.trim().slice(0, 240)}${answer.length > 240 ? "…" : ""} Result: [the outcome, with a number].`,
      followUp: !hasResult ? "What was the result, and how did you measure it?" : !hasAction ? "What did you do yourself, as opposed to the team?" : null,
    };
  }

  async starStory({ bullet, role, company }: { bullet: string; role: string; company: string }): Promise<StarStory> {
    return {
      situation: `As ${role} at ${company}, [describe the challenge or context].`,
      task: "I was responsible for [the goal you owned].",
      action: `I ${lowerFirst(bullet.trim().replace(/[.]$/, ""))}, by [the steps you took].`,
      result: isQuantified(bullet) ? `The result: ${lowerFirst(bullet.trim())}` : "As a result, [the measurable outcome].",
    };
  }

  async companyBrief({ company, role }: { company: string; role: string; description?: string }) {
    return {
      questionsToAsk: [
        `What does success look like for this ${role} in the first six months?`,
        "What are the team's biggest challenges right now?",
        "How does the team plan and prioritise work?",
        "How do you support growth and learning?",
        `What do people enjoy most about working at ${company}?`,
      ],
      themes: [`${company}'s products and customers`, "Recent news and announcements", "The team you would join", "How your experience maps to the job's top three needs"],
    };
  }

  async parseCv({ text }: { text: string }) {
    return { cv: (isLinkedInPdfText(text) ? parseLinkedInPdfText(text) : parseResumeText(text)).cv };
  }

  async improveEntry({ bullets, notes }: { bullets: string[]; notes?: string }) {
    const source = clean(bullets).length ? clean(bullets) : (notes ?? "").split(/\n|(?<=\.)\s+/).map((l) => l.trim()).filter((l) => l.length > 3);
    return {
      bullets: source.slice(0, 8).map((b, i) => {
        const core = b.replace(WEAK, "").replace(/[.;]+$/, "");
        const asPast = toPast(core);
        return asPast ? sentence(asPast) : asAchievement(b, VERBS[i % VERBS.length]!);
      }),
    };
  }

  async organiseSkills({ skills, extra }: { skills: SkillGroupInput[]; extra?: string }) {
    const seen = new Set<string>();
    const groups = [...skills, ...(extra?.trim() ? [{ category: "Other", items: extra }] : [])]
      .map((g) => ({
        category: g.category.trim() || "Skills",
        items: splitList(g.items)
          .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
          .join(", "),
      }))
      .filter((g) => g.items);
    return { skills: groups };
  }

  async linkedinProfile({ cv, targetTitle }: { cv: CV; targetTitle?: string }): Promise<LinkedInProfile> {
    return draftLinkedInProfile(cv, targetTitle);
  }
}
