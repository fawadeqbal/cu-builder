"use client";

import { useEffect, useRef, useState } from "react";
import type { CV, TemplateId } from "@/lib/types";
import { CVDocument } from "@/templates";

const PAGE_MM = 297;
const PRINT_MARGIN_MM = 10 + 12; // top + bottom @page margin in globals.css

/** Shows the CV on an A4 sheet, scaled down to fit the available width. */
export function Preview({ cv, template }: { cv: CV; template: TemplateId }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 0, pages: 1 });

  useEffect(() => {
    const outer = outerRef.current;
    const paper = paperRef.current;
    if (!outer || !paper) return;

    const measure = () => {
      const available = outer.clientWidth - 32;
      const width = paper.offsetWidth;
      const height = paper.offsetHeight;
      const pxPerMm = width / 210;
      const contentMm = height / pxPerMm - PRINT_MARGIN_MM;
      setSize({
        scale: Math.min(1, available / width),
        height,
        pages: Math.max(1, Math.ceil(contentMm / (PAGE_MM - PRINT_MARGIN_MM) - 0.02)),
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(paper);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="preview-outer w-full">
      <div className="no-print mb-3 flex items-center justify-center gap-2 text-xs text-stone-500">
        <span className="rounded-full bg-white px-2.5 py-1 font-medium text-stone-700 shadow-xs ring-1 ring-stone-200">
          ≈ {size.pages} {size.pages === 1 ? "page" : "pages"}
        </span>
        <span className="hidden sm:inline">A4 · updates as you type</span>
      </div>
      <div className="preview-frame mx-auto" style={{ height: size.height ? size.height * size.scale : undefined }}>
        <div
          className="preview-scale origin-top-left"
          style={{
            transform: `scale(${size.scale})`,
            marginLeft: `calc((100% - 210mm * ${size.scale}) / 2)`,
          }}
        >
          <div ref={paperRef} className="paper">
            <CVDocument cv={cv} template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}
