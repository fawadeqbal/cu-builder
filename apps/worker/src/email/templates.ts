import type { EmailJob } from "@cvb/contracts";

export type RenderedEmail = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);

/** One branded, accessible layout for every email: plain text alternative always included. */
function layout(opts: { heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footnote?: string }): string {
  const button = opts.cta
    ? `<p style="margin:28px 0"><a href="${esc(opts.cta.url)}" style="background:#1e4b8f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e4" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<div style="display:inline-block;background:#1e4b8f;color:#fff;font-weight:700;font-size:12px;padding:6px 8px;border-radius:6px">CV</div>
<h1 style="font-size:20px;margin:20px 0 12px">${esc(opts.heading)}</h1>
${opts.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px;color:#44403c">${esc(p)}</p>`).join("")}
${button}
${opts.footnote ? `<p style="font-size:12px;color:#79716b;margin-top:24px">${esc(opts.footnote)}</p>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#79716b;margin-top:16px">CV Builder</p>
</td></tr></table></body></html>`;
}

const text = (lines: (string | undefined)[]) => lines.filter(Boolean).join("\n\n");

export function renderEmail(message: EmailJob, appUrl: string): RenderedEmail {
  switch (message.template) {
    case "welcome": {
      const name = message.name || "there";
      const url = `${appUrl}/app`;
      return {
        subject: "Welcome to CV Builder",
        text: text([`Hi ${name},`, "Your account is ready. Your CVs are saved to your account and open on any device.", `Open your CVs: ${url}`]),
        html: layout({
          heading: `Welcome, ${name}`,
          paragraphs: ["Your account is ready. Your CVs are saved to your account and open on any device."],
          cta: { label: "Open my CVs", url },
        }),
      };
    }
    case "verify-email":
      return {
        subject: "Confirm your email",
        text: text([`Hi ${message.name},`, "Confirm your email address to keep your account secure:", message.url]),
        html: layout({
          heading: "Confirm your email",
          paragraphs: [`Hi ${message.name}, confirm your email address to keep your account secure.`],
          cta: { label: "Confirm email", url: message.url },
          footnote: "If you didn't create an account, you can ignore this email.",
        }),
      };
    case "magic-link":
      return {
        subject: "Your sign-in link",
        text: text(["Use this link to sign in. It works once and expires in 5 minutes:", message.url]),
        html: layout({
          heading: "Sign in to CV Builder",
          paragraphs: ["Use this button to sign in. It works once and expires in 5 minutes."],
          cta: { label: "Sign in", url: message.url },
          footnote: "If you didn't ask to sign in, you can ignore this email.",
        }),
      };
    case "reset-password":
      return {
        subject: "Reset your password",
        text: text([`Hi ${message.name},`, "Use this link to choose a new password:", message.url]),
        html: layout({
          heading: "Reset your password",
          paragraphs: [`Hi ${message.name}, use the button below to choose a new password.`],
          cta: { label: "Choose a new password", url: message.url },
          footnote: "If you didn't ask for this, your password stays the same.",
        }),
      };
    case "receipt": {
      const amount = money(message.amountCents, message.currency);
      return {
        subject: `Receipt: ${message.description}`,
        text: text([`Hi ${message.name},`, `Thanks for your purchase: ${message.description}, ${amount}.`, `Manage billing: ${appUrl}/account/billing`]),
        html: layout({
          heading: "Thanks for your purchase",
          paragraphs: [`${message.description}`, `Total: ${amount}`],
          cta: { label: "View billing", url: `${appUrl}/account/billing` },
        }),
      };
    }
    case "resume-viewed": {
      const what = message.views === 1 ? "Someone opened" : `Your link has been opened ${message.views} times:`;
      return {
        subject: message.views === 1 ? `Your CV was viewed: ${message.resumeTitle}` : `${message.views} views: ${message.resumeTitle}`,
        text: text([`${what} "${message.resumeTitle}".`, `See your share links: ${appUrl}/app`]),
        html: layout({
          heading: message.views === 1 ? "Your CV was viewed" : `${message.views} views and counting`,
          paragraphs: [`${what} “${message.resumeTitle}”.`],
          cta: { label: "Open my CVs", url: `${appUrl}/app` },
        }),
      };
    }
  }
}
