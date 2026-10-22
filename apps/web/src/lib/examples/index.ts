import { BUSINESS } from "./business";
import { EARLY_CAREER, EDUCATION } from "./education-early";
import { ENGINEERING } from "./engineering";
import { FINANCE, HEALTHCARE } from "./finance-health";
import { TECHNOLOGY } from "./technology";
import type { CvExample, ExampleCategory } from "./types";

export type { CvExample, ExampleCategory } from "./types";

/** Every CV example, in the order the index page lists them. */
export const EXAMPLES: CvExample[] = [...TECHNOLOGY, ...FINANCE, ...HEALTHCARE, ...ENGINEERING, ...BUSINESS, ...EDUCATION, ...EARLY_CAREER];

export const EXAMPLE_CATEGORIES: ExampleCategory[] = ["Technology", "Creative", "Finance", "Healthcare", "Engineering", "Business and sales", "Education", "Early career"];

export const exampleBySlug = (slug: string): CvExample | undefined => EXAMPLES.find((e) => e.slug === slug);

export const examplePath = (slug: string) => `/cv-examples/${slug}`;

/** "Software engineer CV example" */
export const exampleTitle = (e: CvExample) => `${e.role} CV example`;

/** Other examples to suggest: same category first, then the rest in order. */
export function relatedExamples(e: CvExample, count = 3): CvExample[] {
  const others = EXAMPLES.filter((x) => x.slug !== e.slug);
  return [...others.filter((x) => x.category === e.category), ...others.filter((x) => x.category !== e.category)].slice(0, count);
}
