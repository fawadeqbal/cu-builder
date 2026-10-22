import type { CV, TemplateId } from "@/lib/types";
import { AtsTemplate } from "./AtsTemplate";
import { ClassicTemplate } from "./ClassicTemplate";
import { ModernTemplate } from "./ModernTemplate";

export function CVDocument({ cv, template }: { cv: CV; template: TemplateId }) {
  if (template === "modern") return <ModernTemplate cv={cv} />;
  if (template === "ats") return <AtsTemplate cv={cv} />;
  return <ClassicTemplate cv={cv} />;
}
