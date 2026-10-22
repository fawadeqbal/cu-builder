"use client";

import { useState } from "react";
import { Button } from "@cvb/ui";

/** A small "Copy" button for a piece of text (sample summaries, AI suggestions). */
export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is on screen to select by hand.
    }
  }
  return (
    <Button size="sm" variant="secondary" icon={copied ? "check" : "copy"} onClick={() => void copy()} className="self-start">
      {copied ? "Copied" : label}
    </Button>
  );
}
