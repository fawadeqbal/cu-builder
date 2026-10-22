export * from "./bank";

export type AnswerScores = { structure: number; relevance: number; clarity: number };

/** Average per criterion across answered questions, and overall, rounded to one decimal. */
export function sessionSummary(answers: { scores: AnswerScores }[]): { structure: number; relevance: number; clarity: number; overall: number; answered: number } {
  if (!answers.length) return { structure: 0, relevance: 0, clarity: 0, overall: 0, answered: 0 };
  const avg = (k: keyof AnswerScores) => Math.round((answers.reduce((n, a) => n + a.scores[k], 0) / answers.length) * 10) / 10;
  const structure = avg("structure");
  const relevance = avg("relevance");
  const clarity = avg("clarity");
  return { structure, relevance, clarity, overall: Math.round(((structure + relevance + clarity) / 3) * 10) / 10, answered: answers.length };
}
