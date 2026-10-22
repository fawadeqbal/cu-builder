import type { Metadata } from "next";
import { ToolPage } from "@/components/tools/ToolPage";
import { SummaryGenerator } from "@/components/tools/SummaryGenerator";

const TITLE = "Free CV summary generator";
const DESCRIPTION = "Write a professional CV summary in seconds. Add your job title, skills and highlights, and AI drafts two summaries from your own facts. No sign-up.";

export const metadata: Metadata = {
  title: `${TITLE} with AI · CV Builder`,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/summary-generator" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/tools/summary-generator" },
};

export default function Page() {
  return (
    <ToolPage
      path="/tools/summary-generator"
      title={TITLE}
      description={DESCRIPTION}
      lead="Tell us the job you want and a few facts about you. AI writes two short summaries from what you typed, never from guesses."
      tips={[
        { title: "Two to four sentences", text: "Who you are, what you're best at and what you want next. Recruiters read it in a few seconds." },
        { title: "Use the advert's job title", text: "Matching the title in the advert helps tracking systems and tells the reader you're a fit." },
        { title: "Facts, not adjectives", text: "“Five years in retail banking” says more than “hard-working and passionate”." },
      ]}
    >
      <SummaryGenerator />
    </ToolPage>
  );
}
