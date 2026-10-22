"use client";

import { useMemo } from "react";
import { applyOverrides, TEMPLATES, templateMeta, type TemplateId, type TemplateMeta } from "@cvb/templates/catalog";
import { useTemplateSettings } from "./queries";

/**
 * The template catalog with the admin's changes applied (published, tier, order).
 * `meta()` still answers for an unpublished template, so CVs already using one keep rendering.
 */
export function useCatalog(): { templates: TemplateMeta[]; meta: (id: TemplateId) => TemplateMeta } {
  const settings = useTemplateSettings();
  return useMemo(() => {
    const overrides = settings.data ?? [];
    const templates = applyOverrides(TEMPLATES, overrides);
    const all = applyOverrides(TEMPLATES, overrides.map((o) => ({ ...o, enabled: true })));
    const byId = new Map(all.map((t) => [t.id, t]));
    return { templates, meta: (id: TemplateId) => byId.get(id) ?? templateMeta(id) };
  }, [settings.data]);
}
