import type { CSSProperties } from "react";
import { templateMeta, type TemplateId } from "./catalog";

export type LetterContent = {
  recipient: string;
  company: string;
  address: string;
  date: string;
  subject: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
  signature: string;
};

export type LetterSender = { name: string; headline: string; email: string; phone: string; location: string };

/** Which letter layout goes with a CV template, so a CV and its letter look like a set. */
export function letterVariant(template: TemplateId): "classic" | "band" | "elegant" {
  const style = templateMeta(template).style;
  if (style === "executive") return "elegant";
  if (style === "modern" || style === "creative") return "band";
  return "classic";
}

/** A cover letter sheet styled to match the CV template (accent colour and layout family). */
export function CoverLetterDocument({
  letter,
  sender,
  template,
  accent,
}: {
  letter: LetterContent;
  sender: LetterSender;
  template: TemplateId;
  accent?: string | null;
}) {
  const variant = letterVariant(template);
  const style = { "--cv-accent": accent || templateMeta(template).accent } as CSSProperties;
  const contact = [sender.email, sender.phone, sender.location].filter((v) => v.trim());
  const paragraphs = letter.paragraphs.filter((p) => p.trim());
  return (
    // The letter follows its own text direction, not the interface language (an English letter stays
    // left-to-right inside the Urdu or Arabic interface).
    <div className={`cv-doc letter letter-${variant}`} style={style} dir="auto">
      <header className="letter-head">
        <div className="letter-name">{sender.name || "Your name"}</div>
        {sender.headline && <div className="letter-title">{sender.headline}</div>}
        {contact.length > 0 && <div className="letter-contact">{contact.join("  ·  ")}</div>}
      </header>
      <div className="letter-body">
        {letter.date && <p className="letter-date">{letter.date}</p>}
        {(letter.recipient || letter.company || letter.address) && (
          <p className="letter-to">
            {[letter.recipient, letter.company, letter.address].filter((v) => v.trim()).map((line, i) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))}
          </p>
        )}
        {letter.subject && <p className="letter-subject">{letter.subject}</p>}
        {letter.greeting && <p>{letter.greeting}</p>}
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {(letter.closing || letter.signature) && (
          <p className="letter-sign">
            {letter.closing}
            <br />
            <span className="letter-signature">{letter.signature}</span>
          </p>
        )}
      </div>
    </div>
  );
}
