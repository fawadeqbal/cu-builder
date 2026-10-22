import type { CSSProperties } from "react";
import type { Stage } from "@cvb/ui";

const STAGES: Stage[] = ["saved", "applied", "interview", "offer", "rejected"];

/** The stage colour for a board column. Custom columns borrow the nearest built-in stage by name. */
export function stageOf(key: string): Stage {
  if ((STAGES as string[]).includes(key)) return key as Stage;
  const k = key.toLowerCase();
  if (/interview|screen|call|assessment|test/.test(k)) return "interview";
  if (/offer|hired/.test(k)) return "offer";
  if (/reject|declin|closed|withdr/.test(k)) return "rejected";
  if (/appl|sent|submit/.test(k)) return "applied";
  return "saved";
}

/** Inline style that sets `--stage` for the DS column, event and dot styles. */
export const stageVar = (key: string) => ({ ["--stage" as string]: `var(--stage-${stageOf(key)})` }) as CSSProperties;
