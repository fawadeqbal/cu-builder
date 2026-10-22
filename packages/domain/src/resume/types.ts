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

/** Personal details some regions expect (Gulf, Pakistan/India, Europass). All optional text. */
export type PersonalDetails = {
  dateOfBirth: string;
  nationality: string;
  gender: string;
  maritalStatus: string;
  visaStatus: string;
  drivingLicence: string;
  fatherName: string;
  idNumber: string;
  religion: string;
};

export type Region = "default" | "us" | "uk" | "europass" | "gulf" | "south_asia";
export type CVDirection = "auto" | "ltr" | "rtl";
/** Language of the CV's own headings ("Experience" / "تجربہ" / "الخبرة"); auto follows the script. */
export type CVLanguage = "auto" | "en" | "ur" | "ar";
export type PhotoShape = "circle" | "square" | "rounded";

/** How the CV is presented: reading direction, regional conventions, photo. */
export type CVSettings = {
  direction: CVDirection;
  language: CVLanguage;
  region: Region;
  photo: { show: boolean; shape: PhotoShape };
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
  details: PersonalDetails;
  /** Profile photo as a small JPEG data URL ("" for none). */
  photo: string;
  settings: CVSettings;
};

export type ListKey =
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "certificates"
  | "languages";


/** Ids of the editor steps; templates tag sections with them for click-to-edit. */
export const STEP_IDS = ["personal", "summary", "experience", "education", "skills", "projects", "extras", "finish"] as const;
export type StepId = (typeof STEP_IDS)[number];

/** Steps a CV can do without. */
export const OPTIONAL_STEPS: ReadonlySet<StepId> = new Set(["experience", "education", "projects", "extras"]);
