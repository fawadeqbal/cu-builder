"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import type { TemplateId } from "@cvb/templates/catalog";

const A4_PX = 793.7; // 210mm at 96dpi

/**
 * Like ScaledCV, but rendered on the server too: it starts at `initialScale` (a good guess for
 * the box) so the CV is in the page's HTML for search engines, then fits the box exactly once
 * measured in the browser. Fill a PaperSheet, or any relative box, with it.
 */
export function FittedCV({ cv, template, accent, initialScale = 0.5 }: { cv: CV; template: TemplateId; accent?: string | null; initialScale?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(initialScale);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => el.clientWidth > 0 && setScale(el.clientWidth / A4_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden" dir="ltr">
      <div className="absolute left-0 top-0 w-[210mm] origin-top-left" style={{ transform: `scale(${scale})` }}>
        <div className="paper !shadow-none">
          <CVDocument cv={cv} template={template} accent={accent} />
        </div>
      </div>
    </div>
  );
}
