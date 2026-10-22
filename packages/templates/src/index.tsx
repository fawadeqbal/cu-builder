import { type CV } from "@cvb/domain";
import type { ComponentType, CSSProperties } from "react";
import { BoardroomTemplate } from "./BoardroomTemplate";
import { templateMeta, type TemplateId } from "./catalog";
import { ClassicTemplate } from "./ClassicTemplate";
import { CompactTemplate } from "./CompactTemplate";
import { CreativeTemplate } from "./CreativeTemplate";
import { ElegantTemplate } from "./ElegantTemplate";
import { ExecutiveTemplate } from "./ExecutiveTemplate";
import { ModernTemplate } from "./ModernTemplate";
import { NordicTemplate } from "./NordicTemplate";
import { SidebarTemplate } from "./SidebarTemplate";
import { SimpleTemplate } from "./SimpleTemplate";
import { TechTemplate } from "./TechTemplate";
import { TimelineTemplate } from "./TimelineTemplate";

export * from "./catalog";
export { CoverLetterDocument, letterVariant, type LetterContent, type LetterSender } from "./CoverLetterDocument";

const COMPONENTS: Record<TemplateId, ComponentType<{ cv: CV }>> = {
  simple: SimpleTemplate,
  compact: CompactTemplate,
  classic: ClassicTemplate,
  modern: ModernTemplate,
  timeline: TimelineTemplate,
  nordic: NordicTemplate,
  sidebar: SidebarTemplate,
  tech: TechTemplate,
  creative: CreativeTemplate,
  elegant: ElegantTemplate,
  executive: ExecutiveTemplate,
  boardroom: BoardroomTemplate,
};

/** Renders the CV with a template. `accent` overrides the template's own colour. */
/**
 * Renders a CV. `scale` (from "Fit to one page") shrinks type and spacing together with CSS zoom,
 * which keeps line breaks and page breaks consistent between the preview, print and the PDF.
 */
export function CVDocument({ cv, template, accent, scale = 1 }: { cv: CV; template: TemplateId; accent?: string | null; scale?: number }) {
  const Template = COMPONENTS[template] ?? ClassicTemplate;
  const style = { "--cv-accent": accent || templateMeta(template).accent, ...(scale !== 1 ? { zoom: scale } : {}) } as CSSProperties;
  return (
    <div className="cv-doc" style={style}>
      <Template cv={cv} />
    </div>
  );
}
