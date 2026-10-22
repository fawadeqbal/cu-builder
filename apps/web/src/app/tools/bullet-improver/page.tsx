import type { Metadata } from "next";
import { BulletImprover } from "@/components/tools/BulletImprover";
import { ToolPage } from "@/components/tools/ToolPage";

const TITLE = "Free CV bullet point improver";
const DESCRIPTION = "Turn a CV duty like “responsible for…” into a strong achievement line. Paste one line and AI suggests three stronger versions. No sign-up.";

export const metadata: Metadata = {
  title: `${TITLE} with AI · CV Builder`,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/bullet-improver" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/tools/bullet-improver" },
};

export default function Page() {
  return (
    <ToolPage
      path="/tools/bullet-improver"
      title={TITLE}
      description={DESCRIPTION}
      lead="Paste a line from your CV. AI rewrites it as an achievement that starts with an action verb, and leaves [number] where a real figure belongs."
      tips={[
        { title: "Start with an action verb", text: "Led, Built, Reduced, Trained. Drop “responsible for” and “helped with”." },
        { title: "Add a number you can explain", text: "People, money, time, percentages or volume. Interviewers will ask how you got it." },
        { title: "Say what changed", text: "End the line with the result: faster, cheaper, more customers, fewer errors." },
      ]}
    >
      <BulletImprover />
    </ToolPage>
  );
}
