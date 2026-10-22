import { ImageResponse } from "next/og";

/** Open Graph image size (what Facebook, LinkedIn, WhatsApp and X expect). */
export const OG_SIZE = { width: 1200, height: 630 };

const BLUE = "#004494";
const GOLD = "#ffd617";

/**
 * The brand share image: EU blue with a gold accent, a title and a line under it, and a stylised
 * CV page on the right. Used site-wide and, with the role name, for each CV example.
 */
export function brandImage({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle: string }): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BLUE, color: "#ffffff", padding: "64px 72px", position: "relative", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", top: -160, right: -120, width: 520, height: 520, borderRadius: 9999, background: GOLD, opacity: 0.16, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: GOLD, color: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800 }}>CV</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>CV Builder</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {eyebrow && <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{eyebrow}</div>}
            <div style={{ display: "flex", fontSize: title.length > 34 ? 60 : 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</div>
            <div style={{ display: "flex", fontSize: 30, lineHeight: 1.35, color: "rgba(255,255,255,0.86)" }}>{subtitle}</div>
          </div>
          <div style={{ display: "flex", width: 120, height: 8, borderRadius: 4, background: GOLD }} />
        </div>
        <div style={{ position: "absolute", right: 72, top: 92, width: 300, height: 424, background: "#ffffff", borderRadius: 10, display: "flex", flexDirection: "column", padding: 30, gap: 12, transform: "rotate(-3deg)", boxShadow: "0 30px 60px rgba(0,0,0,0.25)" }}>
          <div style={{ display: "flex", width: 160, height: 18, borderRadius: 4, background: BLUE }} />
          <div style={{ display: "flex", width: 110, height: 10, borderRadius: 4, background: "#9aa4b2" }} />
          <div style={{ display: "flex", width: 70, height: 10, borderRadius: 4, background: GOLD, marginTop: 14 }} />
          {[92, 84, 88, 60].map((w, i) => (
            <div key={`a${i}`} style={{ display: "flex", width: `${w}%`, height: 8, borderRadius: 4, background: "#d5dae1" }} />
          ))}
          <div style={{ display: "flex", width: 70, height: 10, borderRadius: 4, background: GOLD, marginTop: 14 }} />
          {[90, 76, 86, 70, 54].map((w, i) => (
            <div key={`b${i}`} style={{ display: "flex", width: `${w}%`, height: 8, borderRadius: 4, background: "#d5dae1" }} />
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
