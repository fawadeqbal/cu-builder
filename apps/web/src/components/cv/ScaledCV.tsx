"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CV } from "@cvb/domain";
import { CVDocument } from "@cvb/templates";
import type { TemplateId } from "@cvb/templates/catalog";

const A4_PX = 793.7; // 210mm at 96dpi

/** A CV page scaled to the width of the box it sits in (fill a PaperSheet with it). */
export function ScaledCV({ cv, template, accent }: { cv: CV; template: TemplateId; accent?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / A4_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0" dir="ltr">
      {scale > 0 && (
        <div className="absolute start-0 top-0 w-[210mm] origin-top-left" style={{ transform: `scale(${scale})` }}>
          <div className="paper !shadow-none">
            <CVDocument cv={cv} template={template} accent={accent} />
          </div>
        </div>
      )}
    </div>
  );
}
