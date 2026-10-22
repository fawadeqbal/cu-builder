import type { LinkedInProfileDto } from "@cvb/contracts";
import { LINKEDIN_LIMITS } from "@cvb/domain";

/** One part of a LinkedIn profile to copy, with LinkedIn's limit for it. */
export type LinkedInPart = { key: string; label: string; text: string; max: number | null };

/** The parts of a written profile in the order LinkedIn's edit screens ask for them. */
export function linkedinParts(p: LinkedInProfileDto): { main: LinkedInPart[]; headlines: LinkedInPart[]; experience: LinkedInPart[]; skills: LinkedInPart } {
  return {
    main: [
      { key: "headline", label: "Headline", text: p.headline, max: LINKEDIN_LIMITS.headline },
      { key: "about", label: "About", text: p.about, max: LINKEDIN_LIMITS.about },
    ],
    headlines: p.headlineOptions.map((text, i) => ({ key: `headline-${i}`, label: `Option ${i + 1}`, text, max: LINKEDIN_LIMITS.headline })),
    experience: p.experience.map((e) => ({ key: `exp-${e.id}`, label: [e.role, e.company].filter(Boolean).join(" · ") || "Job", text: e.description, max: LINKEDIN_LIMITS.experience })),
    skills: { key: "skills", label: "Top skills", text: p.skills.join(", "), max: null },
  };
}

/** "123 / 220"; over the limit is flagged so it can be shown as an error. */
export const charCount = (text: string, max: number | null) => ({ label: max ? `${text.length.toLocaleString()} / ${max.toLocaleString()}` : `${text.length.toLocaleString()} characters`, over: max !== null && text.length > max });
