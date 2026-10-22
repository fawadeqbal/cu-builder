import { defaultSettings, emptyCV, emptyDetails, type CV, type CVSettings, type PersonalDetails } from "@cvb/domain";
import type { TemplateId } from "@cvb/templates/catalog";

/*
 * CV example pages (/cv-examples/[slug]). Every person, company, school and number in these CVs
 * is made up to show the format; the pages say so. Phone numbers use ranges set aside for drama
 * and examples where one exists (UK 07700 900xxx), and every email is @example.com.
 */

export type ExampleCategory = "Technology" | "Finance" | "Healthcare" | "Engineering" | "Business and sales" | "Education" | "Creative" | "Early career";

export type CvExample = {
  slug: string;
  /** The role in sentence case, e.g. "Software engineer". */
  role: string;
  category: ExampleCategory;
  /** Meta description and card text (about 150 characters). */
  description: string;
  /** One or two sentences under the heading. */
  intro: string;
  /** A basic-tier template, so a guest can download the result. */
  template: TemplateId;
  accent: string | null;
  cv: CV;
  /** Writing tips specific to the role (4–6). */
  tips: { title: string; text: string }[];
  /** Key skills employers look for (8–12). */
  skills: string[];
  /** A short summary someone can adapt, for a different level than the example CV. */
  sampleSummary: { label: string; text: string };
  /** Two or three questions people ask about this kind of CV. */
  faqs: { q: string; a: string }[];
};

type Job = { role: string; company: string; location?: string; date: string; bullets: string[]; stack?: string };
type School = { degree: string; school: string; date: string; details?: string };

export type ExampleCvInput = {
  name: string;
  headline: string;
  tagline?: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  website?: string;
  github?: string;
  summary: string;
  experience?: Job[];
  projects?: { name: string; date?: string; links?: string[]; bullets: string[]; stack?: string }[];
  skills: Record<string, string>;
  education: School[];
  certificates?: { name: string; issuer: string; year: string }[];
  languages?: [name: string, level: string][];
  details?: Partial<PersonalDetails>;
  settings?: Partial<CVSettings>;
};

/** Builds a full CV from the short form the example files use (ids, empty fields filled in). */
export function exampleCv(slug: string, x: ExampleCvInput): CV {
  const id = (kind: string, i: number) => `${slug}-${kind}-${i + 1}`;
  return {
    ...emptyCV,
    personal: {
      ...emptyCV.personal,
      name: x.name,
      headline: x.headline,
      tagline: x.tagline ?? "",
      email: x.email,
      phone: x.phone,
      location: x.location,
      linkedin: x.linkedin ?? "",
      website: x.website ?? "",
      github: x.github ?? "",
    },
    summary: x.summary,
    experience: (x.experience ?? []).map((e, i) => ({ id: id("exp", i), location: "", stack: "", ...e })),
    projects: (x.projects ?? []).map((p, i) => ({ id: id("proj", i), date: "", links: [], stack: "", ...p })),
    skills: Object.entries(x.skills).map(([category, items], i) => ({ id: id("skill", i), category, items })),
    education: x.education.map((e, i) => ({ id: id("edu", i), details: "", ...e })),
    certificates: (x.certificates ?? []).map((c, i) => ({ id: id("cert", i), url: "", ...c })),
    languages: (x.languages ?? []).map(([name, level], i) => ({ id: id("lang", i), name, level })),
    details: { ...emptyDetails, ...x.details },
    photo: "",
    settings: { ...defaultSettings, ...x.settings },
  };
}
