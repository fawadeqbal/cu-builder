import { cvDirection, cvLanguage, type CV } from "@cvb/domain";
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
export { cvLabels, type Translate } from "./shared";
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
export type CVBrand = { name?: string; logoUrl?: string };

export function CVDocument({
  cv,
  template,
  accent,
  scale = 1,
  brand,
}: {
  cv: CV;
  template: TemplateId;
  accent?: string | null;
  scale?: number;
  /** An agency's or institution's mark above the CV (white label, agency-formatted CVs). */
  brand?: CVBrand | null;
}) {
  const Template = COMPONENTS[template] ?? ClassicTemplate;
  const style = { "--cv-accent": accent || templateMeta(template).accent, ...(scale !== 1 ? { zoom: scale } : {}) } as CSSProperties;
  const dir = cvDirection(cv);
  return (
    <div className="cv-doc" style={style} dir={dir} lang={cvLanguage(cv) === "en" ? undefined : cvLanguage(cv)}>
      {brand && (brand.logoUrl || brand.name) && (
        <div className="cv-brand">
          {brand.logoUrl && <img src={brand.logoUrl} alt="" className="cv-brand-logo" />}
          {brand.name && <span className="cv-brand-name">{brand.name}</span>}
        </div>
      )}
      <Template cv={cv} />
    </div>
  );
}
