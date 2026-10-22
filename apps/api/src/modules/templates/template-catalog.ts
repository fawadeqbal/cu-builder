import type { TemplateSettingDto, UpdateTemplateSettingDto } from "@cvb/contracts";
import type { TemplateTier } from "@cvb/domain";
import { templateMeta, type TemplateId } from "@cvb/templates/catalog";

/**
 * The template catalog as the business runs it: the code's catalog plus the admin's changes
 * (unpublished templates, tier changes, order). Gating asks this, not the static catalog, so a
 * tier change in the admin console applies everywhere at once.
 */
export interface TemplateCatalog {
  tierOf(id: TemplateId): Promise<TemplateTier>;
  settings(): Promise<TemplateSettingDto[]>;
  update(id: TemplateId, dto: UpdateTemplateSettingDto): Promise<TemplateSettingDto>;
}

export const TEMPLATE_CATALOG = Symbol.for("cvb.api.TemplateCatalog");

/** No overrides: the code's catalog as written. For tests and tools. */
export class StaticTemplateCatalog implements TemplateCatalog {
  private readonly rows = new Map<string, TemplateSettingDto>();

  async tierOf(id: TemplateId): Promise<TemplateTier> {
    return this.rows.get(id)?.tier ?? templateMeta(id).tier;
  }

  async settings(): Promise<TemplateSettingDto[]> {
    return [...this.rows.values()];
  }

  async update(id: TemplateId, dto: UpdateTemplateSettingDto): Promise<TemplateSettingDto> {
    const prev = this.rows.get(id) ?? { templateId: id, enabled: true, tier: null, sortOrder: null };
    const next = { ...prev, ...dto };
    this.rows.set(id, next);
    return next;
  }
}
