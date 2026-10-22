"use client";

import { whatsappLink } from "@cvb/domain";
import { useHydrated } from "@/lib/hydrated";
import { useT } from "@/lib/i18n";
import { useSiteSettings } from "@/lib/trust";

/**
 * Floating "Help on WhatsApp" button for public pages (landing, pricing, the builder's start
 * screen, experts), never inside the editor. Hidden until an admin sets a number. It sits at the
 * bottom inline-end corner (left in Urdu and Arabic) and, on phones, is a compact circle with a
 * spacer under the page so it never hides the last lines of content.
 */
export function WhatsAppHelp() {
  const t = useT();
  const hydrated = useHydrated();
  const settings = useSiteSettings().data;
  const href = settings
    ? whatsappLink(settings.whatsappNumber, settings.whatsappMessage || t("help.whatsappMessage"))
    : null;
  if (!hydrated || !href) return null;
  return (
    <>
      <div aria-hidden="true" className="no-print h-20 sm:hidden" />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("help.whatsappLabel")}
        className="no-print fixed bottom-[max(1rem,env(safe-area-inset-bottom))] end-4 z-[var(--z-sticky)] inline-flex size-12 items-center justify-center gap-2 rounded-full border border-line bg-surface text-sm font-semibold text-ink shadow-[var(--shadow-md)] transition hover:border-line-strong hover:shadow-[var(--shadow-lg)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none sm:end-6 sm:bottom-6 sm:h-12 sm:w-auto sm:ps-2 sm:pe-4"
      >
        <WhatsAppGlyph />
        <span className="hidden sm:inline [&:lang(ur)]:leading-[1.9]">{t("help.whatsapp")}</span>
      </a>
    </>
  );
}

/** The WhatsApp speech-bubble mark, so people recognise where the link goes. */
function WhatsAppGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#fff"
        d="M16 7.2a8.8 8.8 0 0 0-7.6 13.2L7.2 24.8l4.5-1.2A8.8 8.8 0 1 0 16 7.2Zm0 16a7.2 7.2 0 0 1-3.7-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.2 7.2 0 1 1 16 23.2Zm4-5.4c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a5.9 5.9 0 0 1-2.9-2.5c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.3-.6 1.5-1.1.2-.5.2-1 .1-1.1l-.4-.2Z"
      />
    </svg>
  );
}
