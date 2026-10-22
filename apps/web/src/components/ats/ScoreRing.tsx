/** A circular 0–100 score. Colour follows the grade. */
export function ScoreRing({ score, size = 64, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "#059669" : score >= 70 ? "#1e4b8f" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 0.5s" }}
        />
      </svg>
      <span className="absolute text-base font-bold tabular-nums" style={{ color, fontSize: size * 0.28 }}>
        {score}
      </span>
    </div>
  );
}
