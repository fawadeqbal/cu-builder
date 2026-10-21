import type { CV, TemplateId } from "@/lib/types";
import { ClassicTemplate } from "./ClassicTemplate";
import { ModernTemplate } from "./ModernTemplate";

export function CVDocument({ cv, template }: { cv: CV; template: TemplateId }) {
  return template === "modern" ? <ModernTemplate cv={cv} /> : <ClassicTemplate cv={cv} />;
}
