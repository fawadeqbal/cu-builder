/**
 * The interview question bank: common questions by role family, seniority and competency, each
 * with what a strong answer covers. Curated, so it works without AI; the AI mock interview adds
 * role- and job-specific questions on top.
 */

export const ROLE_FAMILIES = ["general", "software", "data", "design", "product", "sales", "marketing", "operations", "finance"] as const;
export type RoleFamily = (typeof ROLE_FAMILIES)[number];

export const SENIORITIES = ["entry", "mid", "senior", "lead"] as const;
export type InterviewSeniority = (typeof SENIORITIES)[number];

export type BankQuestion = {
  id: string;
  question: string;
  family: RoleFamily;
  competency: string;
  /** Lowest seniority the question suits. */
  from: InterviewSeniority;
  /** The outline of a strong answer. */
  answer: string;
};

const q = (id: string, family: RoleFamily, competency: string, from: InterviewSeniority, question: string, answer: string): BankQuestion => ({
  id,
  family,
  competency,
  from,
  question,
  answer,
});

export const QUESTION_BANK: BankQuestion[] = [
  // General (every role)
  q("g1", "general", "Motivation", "entry", "Tell me about yourself.", "Two minutes: your current role and strongest result, how you got there, and why this role is the logical next step."),
  q("g2", "general", "Motivation", "entry", "Why do you want to work here?", "Something specific about the company (product, customers, mission), how it connects to your experience, and what you want to learn."),
  q("g3", "general", "Strengths", "entry", "What is your greatest strength?", "One strength the job needs, a short story that proves it, and the result."),
  q("g4", "general", "Self-awareness", "entry", "What is a weakness you are working on?", "A real but non-critical weakness, what you are doing about it, and evidence it is improving."),
  q("g5", "general", "Collaboration", "entry", "Tell me about a time you disagreed with a colleague.", "STAR: the disagreement, how you listened and used data, the outcome and the relationship afterwards."),
  q("g6", "general", "Resilience", "entry", "Describe a time you failed.", "Own the mistake, what you did to recover, what you changed so it doesn't happen again."),
  q("g7", "general", "Prioritisation", "entry", "How do you prioritise when everything is urgent?", "Your method (impact vs effort, deadlines, asking stakeholders) and a real example."),
  q("g8", "general", "Ownership", "mid", "Tell me about something you improved without being asked.", "What you noticed, why it mattered, what you did, the measurable result."),
  q("g9", "general", "Influence", "senior", "How have you influenced a decision without authority?", "Building the case with data, finding allies, addressing concerns, and the decision that followed."),
  q("g10", "general", "Leadership", "lead", "How do you build and grow a team?", "Hiring for gaps, clear expectations, regular feedback, growth plans, an example of someone you developed."),
  q("g11", "general", "Planning", "mid", "What would you do in your first 90 days?", "Learn (people, product, problems), deliver an early win, then propose a bigger goal with a plan."),
  q("g12", "general", "Communication", "entry", "Explain something complex to someone non-technical.", "Pick a concept from your field, use an analogy, check understanding."),
  q("g13", "general", "Closing", "entry", "Why should we hire you?", "Three strengths matched to the job's top needs, each with one piece of evidence."),
  q("g14", "general", "Closing", "entry", "What questions do you have for us?", "Two or three about success in the role, the team's challenges, and how decisions are made."),
  // Software
  q("s1", "software", "Technical depth", "entry", "Walk me through a project you built from start to finish.", "Problem, your design choices and trade-offs, what you built, how you tested it, the result and what you'd change."),
  q("s2", "software", "Debugging", "entry", "Tell me about the hardest bug you fixed.", "Symptoms, how you narrowed it down (logs, reproduction, bisecting), the root cause, the fix and the safeguard you added."),
  q("s3", "software", "Code quality", "entry", "How do you make sure your code is good?", "Tests, reviews, readable naming, small changes, CI, and an example where this caught a problem."),
  q("s4", "software", "System design", "mid", "How would you design a URL shortener?", "Requirements, API, data model, ID generation, caching, scaling reads, analytics, failure modes."),
  q("s5", "software", "Performance", "mid", "Tell me about a time you made something faster.", "How you measured, what the bottleneck was, the change, before/after numbers."),
  q("s6", "software", "Architecture", "senior", "How do you decide between a monolith and microservices?", "Team size, domain boundaries, deployment needs, operational cost; a decision you made and how it worked out."),
  q("s7", "software", "Reliability", "senior", "How do you handle a production incident?", "Mitigate first, communicate, find root cause, blameless review, prevention work."),
  q("s8", "software", "Leadership", "lead", "How do you balance technical debt with new features?", "Make debt visible, tie it to delivery speed or risk, reserve capacity, an example of a negotiated trade-off."),
  q("s9", "software", "Collaboration", "mid", "How do you work with product and design?", "Early involvement, clarifying requirements, raising trade-offs, a feature you shaped together."),
  // Data
  q("d1", "data", "Analysis", "entry", "Walk me through an analysis that changed a decision.", "Question, data, method, the finding, how you presented it, what changed."),
  q("d2", "data", "Statistics", "mid", "How would you design an A/B test?", "Hypothesis, metric, sample size and power, randomisation, duration, pitfalls like peeking."),
  q("d3", "data", "Data quality", "entry", "What do you do when the data looks wrong?", "Check sources and pipelines, compare with known totals, document assumptions, fix upstream."),
  q("d4", "data", "Modelling", "senior", "How do you know a model is good enough to ship?", "Baseline, offline metrics that match the business goal, error analysis, monitoring after launch."),
  // Design
  q("de1", "design", "Process", "entry", "Walk me through your design process on a recent project.", "Research, problem framing, options, testing with users, iteration, the shipped result."),
  q("de2", "design", "Feedback", "entry", "How do you handle feedback you disagree with?", "Understand the reason, test both options if possible, decide on evidence."),
  q("de3", "design", "Impact", "mid", "How do you measure if a design worked?", "Success metrics agreed up front, usability results, product metrics after launch."),
  q("de4", "design", "Systems", "senior", "How would you build or evolve a design system?", "Audit, principles, components with clear ownership, adoption, governance."),
  // Product
  q("p1", "product", "Prioritisation", "entry", "How do you decide what to build next?", "Goals, customer evidence, impact vs effort, a framework you used and a trade-off you made."),
  q("p2", "product", "Discovery", "mid", "Tell me about a product you improved based on user research.", "What you learned, the change, how you measured it."),
  q("p3", "product", "Strategy", "senior", "What would you change about our product?", "Show you've used it, one clear opportunity, how you'd validate it."),
  q("p4", "product", "Stakeholders", "mid", "How do you say no to a stakeholder?", "Understand the need, explain trade-offs with data, offer alternatives."),
  // Sales
  q("sa1", "sales", "Results", "entry", "Tell me about your best quarter.", "Target vs result, the deals that made it, what you did differently."),
  q("sa2", "sales", "Objections", "entry", "How do you handle a customer who says it's too expensive?", "Understand the real concern, reframe value, options; an example."),
  q("sa3", "sales", "Pipeline", "mid", "How do you build and manage your pipeline?", "Prospecting sources, qualification, cadence, CRM hygiene, forecast accuracy."),
  q("sa4", "sales", "Role play", "entry", "Sell me this pen.", "Ask questions first, find the need, connect features to it, close."),
  // Marketing
  q("m1", "marketing", "Campaigns", "entry", "Tell me about a campaign you ran and its results.", "Goal, audience, channels, budget, results against target, what you learned."),
  q("m2", "marketing", "Analytics", "mid", "How do you measure marketing ROI?", "Attribution approach, leading and lagging metrics, an example."),
  q("m3", "marketing", "Strategy", "senior", "How would you grow our user base in 12 months?", "Audience, positioning, channel bets with experiments, metrics and budget."),
  // Operations
  q("o1", "operations", "Process", "entry", "Tell me about a process you made more efficient.", "Before, what you changed, after (time, cost, errors saved)."),
  q("o2", "operations", "Problem solving", "mid", "Describe a time something went wrong in operations.", "What happened, how you contained it, root cause, prevention."),
  q("o3", "operations", "Leadership", "lead", "How do you manage a team through change?", "Explain why, involve people, support, measure adoption."),
  // Finance
  q("f1", "finance", "Analysis", "entry", "Walk me through a financial model you built.", "Purpose, key drivers, assumptions, checks, how it was used."),
  q("f2", "finance", "Accuracy", "entry", "How do you make sure your numbers are right?", "Reconciliations, reviews, controls, a mistake you caught."),
  q("f3", "finance", "Business partnering", "mid", "How do you explain financials to non-finance colleagues?", "Focus on decisions, simple visuals, an example."),
];

const RANK: Record<InterviewSeniority, number> = { entry: 0, mid: 1, senior: 2, lead: 3 };

/** Guesses the role family from a job title. */
export function roleFamily(title: string): RoleFamily {
  const t = title.toLowerCase();
  if (/(engineer|developer|programmer|devops|sre|software|full.?stack|front.?end|back.?end|mobile)/.test(t)) return "software";
  if (/(data|analyst|analytics|scientist|machine learning|\bml\b|\bbi\b)/.test(t)) return "data";
  if (/(design|ux|ui\b|product designer|graphic)/.test(t)) return "design";
  if (/(product manager|product owner|\bpm\b)/.test(t)) return "product";
  if (/(sales|account executive|business development|\bsdr\b|\bbdr\b)/.test(t)) return "sales";
  if (/(marketing|growth|seo|content|brand|social media)/.test(t)) return "marketing";
  if (/(finance|accountant|accounting|controller|audit|treasury)/.test(t)) return "finance";
  if (/(operations|ops|supply|logistics|project manager|coordinator)/.test(t)) return "operations";
  return "general";
}

/** Questions for a role family and seniority (general ones included), optionally one competency. */
export function questionsFor(input: { family: RoleFamily; seniority: InterviewSeniority; competency?: string }): BankQuestion[] {
  return QUESTION_BANK.filter(
    (x) =>
      (x.family === input.family || x.family === "general") &&
      RANK[x.from] <= RANK[input.seniority] &&
      (!input.competency || x.competency === input.competency),
  );
}

export const COMPETENCIES = [...new Set(QUESTION_BANK.map((x) => x.competency))].sort();
