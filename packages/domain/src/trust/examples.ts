import { defaultSettings, emptyCV, emptyDetails, emptyPersonal } from "../resume/model";
import type { CV } from "../resume/types";

/*
 * Example CVs for the landing page's before-and-after. Made up and labelled as examples
 * wherever they appear. The "after" uses figures the person would add themselves; the AI never
 * supplies them (it leaves [number] placeholders instead).
 */

/** A typical first draft: duty-led lines, no numbers, a thin summary and a sentence for skills. */
export const beforeExampleCV: CV = {
  ...emptyCV,
  personal: { ...emptyPersonal, name: "Ali Raza", email: "ali.raza@example.com", location: "Karachi" },
  summary: "I am a hard-working person looking for a good job in sales.",
  experience: [
    {
      id: "before-exp-1",
      role: "Sales Executive",
      company: "City Traders",
      location: "Karachi",
      date: "2021 - now",
      bullets: [
        "Responsible for meeting customers in my area",
        "Worked on daily sales reports",
        "Helped the team with stock",
      ],
      stack: "",
    },
  ],
  education: [{ id: "before-edu-1", degree: "BBA", school: "University of Karachi", date: "06/2020", details: "" }],
  skills: [
    {
      id: "before-skill-1",
      category: "Skills",
      items: "good communication and hard working and team player and MS office",
    },
  ],
  details: emptyDetails,
  settings: defaultSettings,
};

/** The same person after working through the ATS report: action-led lines with their own figures. */
export const afterExampleCV: CV = {
  ...beforeExampleCV,
  personal: {
    ...beforeExampleCV.personal,
    headline: "Sales Executive",
    phone: "+92 300 0000000",
    location: "Karachi, Pakistan",
    linkedin: "linkedin.com/in/ali-raza-example",
  },
  summary:
    "Sales executive with three years in retail distribution across Karachi. Builds lasting relationships with shop owners, keeps daily reporting accurate and knows the product range in depth. Looking to grow into a key account role.",
  experience: [
    {
      ...beforeExampleCV.experience[0]!,
      date: "Jan 2021 – Present",
      bullets: [
        "Visit 25 retailers a week across two districts and opened 40 new accounts in 2024.",
        "Built a daily sales report in Excel that the regional manager now uses for all six reps.",
        "Reduced out-of-stock orders by 30% by checking shelf stock before each visit.",
      ],
    },
  ],
  education: [{ ...beforeExampleCV.education[0]!, date: "Jun 2020" }],
  skills: [
    {
      id: "after-skill-1",
      category: "Sales",
      items: "Retail distribution, Account management, Negotiation, Route planning",
    },
    { id: "after-skill-2", category: "Tools", items: "Excel, Google Sheets, WhatsApp Business" },
  ],
};
