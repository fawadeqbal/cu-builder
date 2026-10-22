import { ScoreRing as DsScoreRing } from "@cvb/ui";

/** A circular 0–100 score (the design-system ring). `size` in px picks the nearest ring: 40, 64 or 112. */
export function ScoreRing({ score, size = 64, label }: { score: number; size?: number; label?: string }) {
  const ring = size <= 48 ? "sm" : size >= 96 ? "lg" : "md";
  return <DsScoreRing value={score} size={ring} label={`${label ?? "Score"} ${score} out of 100`} />;
}
