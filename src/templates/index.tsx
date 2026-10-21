import type { ComponentType, CSSProperties } from "react";
import type { CV } from "@/lib/types";
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
export function CVDocument({ cv, template, accent }: { cv: CV; template: TemplateId; accent?: string | null }) {
  const Template = COMPONENTS[template] ?? ClassicTemplate;
  const style = { "--cv-accent": accent || templateMeta(template).accent } as CSSProperties;
  return (
    <div className="cv-doc" style={style}>
      <Template cv={cv} />
    </div>
  );
}
