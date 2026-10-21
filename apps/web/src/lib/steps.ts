import type { StepId } from "@cvb/domain";

export type { StepId };

export type Step = {
  id: StepId;
  /** Short label for the progress bar. */
  short: string;
  title: string;
  intro: string;
  tips: string[];
  optional?: boolean;
};

export const STEPS: Step[] = [
  {
    id: "personal",
    short: "Details",
    title: "Let's start with the basics",
    intro: "Your name, the job you want and how employers can reach you.",
    tips: [
      "Use a professional email, ideally firstname.lastname@…",
      "Write the job title you are applying for, not only your current one.",
    ],
  },
  {
    id: "summary",
    short: "Summary",
    title: "Write a short summary",
    intro: "Two to four sentences at the top of your CV. It's the first thing a recruiter reads.",
    tips: [
      "Say who you are, what you do and what you are best at.",
      "Mention one or two key skills from the job advert.",
      "Skip words like “hard-working” and show it in your experience instead.",
    ],
  },
  {
    id: "experience",
    short: "Experience",
    title: "Add your work experience",
    intro: "Start with your most recent job. Internships, part-time and freelance work count.",
    optional: true,
    tips: [
      "Start each line with an action verb: Built, Led, Improved, Designed.",
      "Add numbers where you can: users, time saved, money, speed.",
      "Three to five lines per job is enough.",
    ],
  },
  {
    id: "education",
    short: "Education",
    title: "Add your education",
    intro: "Your highest qualification first.",
    optional: true,
    tips: ["Add your CGPA only if it helps you.", "Recent graduates can add a final-year project in the next steps."],
  },
  {
    id: "skills",
    short: "Skills",
    title: "List your skills",
    intro: "Group them so recruiters can scan quickly.",
    tips: [
      "Match the skills named in the job advert.",
      "List only tools you could talk about in an interview.",
    ],
  },
  {
    id: "projects",
    short: "Projects",
    title: "Show your projects",
    intro: "Projects prove what you can build, which matters most when you have little experience.",
    optional: true,
    tips: ["Add a live link or GitHub link if you have one.", "Say what the project does and what you built yourself."],
  },
  {
    id: "extras",
    short: "Extras",
    title: "Languages and certificates",
    intro: "Optional extras that can make the difference.",
    optional: true,
    tips: ["List the languages you speak and your level.", "Add certificates that are relevant to the job."],
  },
  {
    id: "finish",
    short: "Download",
    title: "Choose a design and download",
    intro: "Pick a template. You can switch any time without losing anything.",
    tips: [],
  },
];
