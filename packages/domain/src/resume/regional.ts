import type { CV, PersonalDetails, Region } from "./types";

export type DetailKey = keyof PersonalDetails;
export type PageSizeName = "A4" | "LETTER";

export type RegionRules = {
  region: Region;
  label: string;
  /** Short description of the convention, for the picker. */
  description: string;
  pageSize: PageSizeName;
  /** "no": employers expect none (and anti-discrimination norms); "expected": usually included. */
  photo: "no" | "optional" | "expected";
  /** Personal details shown in this region, in display order. */
  details: DetailKey[];
  /** A template that matches the convention best. */
  suggestedTemplate?: string;
};

export const DETAIL_LABELS: Record<DetailKey, string> = {
  dateOfBirth: "Date of birth",
  nationality: "Nationality",
  gender: "Gender",
  maritalStatus: "Marital status",
  visaStatus: "Visa status",
  drivingLicence: "Driving licence",
  fatherName: "Father's name",
  idNumber: "CNIC / ID number",
  religion: "Religion",
};

const ALL_DETAILS = Object.keys(DETAIL_LABELS) as DetailKey[];

const RULES: Record<Region, RegionRules> = {
  default: {
    region: "default",
    label: "International",
    description: "A4, photo optional, personal details only if you add them.",
    pageSize: "A4",
    photo: "optional",
    details: ALL_DETAILS,
  },
  us: {
    region: "us",
    label: "US resume",
    description: "Letter size, no photo and no personal details (age, marital status).",
    pageSize: "LETTER",
    photo: "no",
    details: [],
  },
  uk: {
    region: "uk",
    label: "UK CV",
    description: "A4, no photo, no date of birth or marital status.",
    pageSize: "A4",
    photo: "no",
    details: ["drivingLicence"],
  },
  europass: {
    region: "europass",
    label: "Europass",
    description: "A4, optional photo, date of birth and nationality; Europass section order.",
    pageSize: "A4",
    photo: "optional",
    details: ["dateOfBirth", "nationality", "gender"],
    suggestedTemplate: "classic",
  },
  gulf: {
    region: "gulf",
    label: "Gulf CV",
    description: "A4, photo, nationality, visa status, date of birth and driving licence.",
    pageSize: "A4",
    photo: "expected",
    details: ["nationality", "visaStatus", "dateOfBirth", "maritalStatus", "drivingLicence"],
  },
  south_asia: {
    region: "south_asia",
    label: "Pakistan / India",
    description: "A4, a personal details section: father's name, date of birth, CNIC, nationality.",
    pageSize: "A4",
    photo: "optional",
    details: ["fatherName", "dateOfBirth", "idNumber", "nationality", "maritalStatus", "religion"],
  },
};

export const REGIONS = Object.keys(RULES) as Region[];

export const regionRules = (region: Region): RegionRules => RULES[region] ?? RULES.default;

/**
 * Switches a CV to a region's conventions. Nothing typed is deleted: details a region doesn't use
 * are simply not shown, so switching back restores them. Returns the page size to use as well.
 */
export function applyRegionPreset(cv: CV, region: Region): { cv: CV; pageSize: PageSizeName; template?: string } {
  const rules = regionRules(region);
  const show = rules.photo === "no" ? false : rules.photo === "expected" ? true : cv.settings.photo.show;
  return {
    cv: { ...cv, settings: { ...cv.settings, region, photo: { ...cv.settings.photo, show } } },
    pageSize: rules.pageSize,
    template: rules.suggestedTemplate,
  };
}

/** The personal details to print: filled in, and used in the CV's region. */
export function visibleDetails(cv: CV): { key: DetailKey; value: string }[] {
  return regionRules(cv.settings.region)
    .details.map((key) => ({ key, value: cv.details[key].trim() }))
    .filter((d) => d.value);
}

/** Whether the photo is printed: there is one, it's switched on, and the region allows photos. */
export const showPhoto = (cv: CV): boolean => Boolean(cv.photo) && cv.settings.photo.show && regionRules(cv.settings.region).photo !== "no";

const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
const LETTER = /\p{L}/gu;
const URDU_ONLY = /[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2\u06D3]/;

/** True when most letters in the text are Arabic-script or Hebrew. */
export function isRtlText(text: string): boolean {
  const letters = text.match(LETTER)?.length ?? 0;
  if (!letters) return false;
  return (text.match(RTL_LETTER)?.length ?? 0) / letters > 0.4;
}

const sample = (cv: CV) => [cv.personal.name, cv.personal.headline, cv.summary, ...cv.experience.slice(0, 2).map((e) => e.role)].join(" ");

/** The reading direction to render: the setting, or detected from the name, headline and summary. */
export function cvDirection(cv: CV): "ltr" | "rtl" {
  if (cv.settings.direction !== "auto") return cv.settings.direction;
  return isRtlText(sample(cv)) ? "rtl" : "ltr";
}

/** The language of the CV's printed headings. */
export function cvLanguage(cv: CV): "en" | "ur" | "ar" {
  if (cv.settings.language !== "auto") return cv.settings.language;
  const text = sample(cv);
  if (!isRtlText(text)) return "en";
  return URDU_ONLY.test(text) ? "ur" : "ar";
}
