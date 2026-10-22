"use client";

import type { ReactNode } from "react";
import { Button, markPlaceholders } from "@cvb/ui";

/** The ghost sparkle button that opens AI help next to a field. */
export function AiButton({ onClick, children, busy = false, title }: { onClick: () => void; children: ReactNode; busy?: boolean; title?: string }) {
  return (
    <Button variant="ghost" size="sm" icon="sparkle" loading={busy} onClick={onClick} title={title} className="[&>.cvb-icon]:text-brand-ink">
      {children}
    </Button>
  );
}

/** One AI suggestion to pick. [Placeholders] are highlighted for the person to fill in. */
export function Suggestion({ text, onUse }: { text: string; onUse: () => void }) {
  return (
    <div className="cvb-ai-option flex-col sm:flex-row">
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{markPlaceholders(text)}</p>
      <Button size="sm" variant="secondary" icon="check" onClick={onUse} className="shrink-0">
        Use this
      </Button>
    </div>
  );
}
