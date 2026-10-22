/** Comparing job offers and drafting a negotiation email. */

export type OfferDetails = {
  baseSalary: number | null;
  currency: string;
  /** Yearly bonus, as an amount. */
  bonus: number | null;
  /** Yearly value of equity, as the person estimates it. */
  equity: number | null;
  benefits: string;
  location: string;
  remote: "onsite" | "hybrid" | "remote" | "";
  /** 1-5: how much the person expects to learn and grow. */
  growth: number | null;
  deadline: string;
  notes: string;
};

export const EMPTY_OFFER: OfferDetails = {
  baseSalary: null,
  currency: "",
  bonus: null,
  equity: null,
  benefits: "",
  location: "",
  remote: "",
  growth: null,
  deadline: "",
  notes: "",
};

export const totalComp = (o: OfferDetails): number => (o.baseSalary ?? 0) + (o.bonus ?? 0) + (o.equity ?? 0);

/** Marks the best offer per row (highest pay, highest growth) for the comparison table. */
export function compareOffers<T extends { id: string; offer: OfferDetails }>(items: T[]): { bestTotal: string | null; bestGrowth: string | null } {
  const withPay = items.filter((i) => totalComp(i.offer) > 0);
  const sameCurrency = new Set(withPay.map((i) => i.offer.currency || "?")).size <= 1;
  const bestTotal = sameCurrency && withPay.length ? withPay.reduce((a, b) => (totalComp(b.offer) > totalComp(a.offer) ? b : a)).id : null;
  const withGrowth = items.filter((i) => i.offer.growth);
  const bestGrowth = withGrowth.length ? withGrowth.reduce((a, b) => ((b.offer.growth ?? 0) > (a.offer.growth ?? 0) ? b : a)).id : null;
  return { bestTotal, bestGrowth };
}

export type NegotiationTemplate = { id: string; name: string; when: string; subject: string; body: string };

/** Plain, polite templates. {placeholders} are filled from the offer and the job. */
export const NEGOTIATION_TEMPLATES: NegotiationTemplate[] = [
  {
    id: "salary",
    name: "Ask for a higher salary",
    when: "You have a number in mind, backed by market data or another offer.",
    subject: "{role} offer: compensation",
    body: `Dear {contact},

Thank you for the offer for the {role} position at {company}. I'm excited about the team and the work.

Based on the scope of the role and what similar positions pay, I was hoping for a base salary closer to {target}. Is there flexibility to meet that figure?

I'm keen to make this work and look forward to hearing from you.

Kind regards,
{name}`,
  },
  {
    id: "competing",
    name: "Mention a competing offer",
    when: "You have another offer and prefer this company.",
    subject: "{role} offer: timing and compensation",
    body: `Dear {contact},

Thank you again for the offer for the {role} role. {company} is my first choice.

I have received another offer at {target} and need to respond by {deadline}. If {company} could come closer to that figure, I would be glad to accept.

Thank you for considering this.

Best regards,
{name}`,
  },
  {
    id: "benefits",
    name: "Negotiate benefits or start date",
    when: "Salary is fixed, but other terms can move.",
    subject: "{role} offer: a few questions",
    body: `Dear {contact},

Thank you for the {role} offer. Before I accept, I'd like to ask about two points:

- {ask_one}
- {ask_two}

These would make a real difference for me. I'm looking forward to joining {company}.

Kind regards,
{name}`,
  },
  {
    id: "time",
    name: "Ask for more time to decide",
    when: "You need a few more days.",
    subject: "{role} offer: decision timing",
    body: `Dear {contact},

Thank you for the offer for the {role} position. I'm very interested and want to give it the consideration it deserves.

Would it be possible to share my decision by {deadline}?

Thank you for understanding.

Best regards,
{name}`,
  },
];

/** Fills {placeholders}; unknown ones stay visible so the person notices them. */
export function fillTemplate(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{([a-z_]+)\}/g, (m, key: string) => values[key]?.trim() || m);
}
