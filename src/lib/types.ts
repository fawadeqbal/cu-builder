export type Personal = {
  name: string;
  headline: string;
  tagline: string;
  phone: string;
  email: string;
  location: string;
  website: string;
  github: string;
  linkedin: string;
  extra: string;
};

export type Experience = {
  id: string;
  role: string;
  company: string;
  location: string;
  date: string;
  bullets: string[];
  stack: string;
};

export type Project = {
  id: string;
  name: string;
  date: string;
  links: string[];
  bullets: string[];
  stack: string;
};

export type SkillGroup = {
  id: string;
  category: string;
  items: string;
};

export type Education = {
  id: string;
  degree: string;
  school: string;
  date: string;
  details: string;
};

export type Certificate = {
  id: string;
  name: string;
  issuer: string;
  year: string;
  url: string;
};

export type Language = {
  id: string;
  name: string;
  level: string;
};

export type CV = {
  personal: Personal;
  summary: string;
  experience: Experience[];
  projects: Project[];
  skills: SkillGroup[];
  education: Education[];
  certificates: Certificate[];
  languages: Language[];
};

export type ListKey =
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "certificates"
  | "languages";

export type { TemplateId } from "@/templates/catalog";
