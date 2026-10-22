import type { TemplateSettingDto, UpdateTemplateSettingDto } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { TEMPLATE_TIERS, type TemplateTier } from "@cvb/domain";
import { templateMeta, type TemplateId } from "@cvb/templates/catalog";
import { Inject, Injectable } from "@nestjs/common";
import type { TemplateCatalog } from "./template-catalog.js";

const CACHE_MS = 30_000;
const asTier = (v: string | null): TemplateTier | null =>
  (TEMPLATE_TIERS as readonly string[]).includes(v ?? "") ? (v as TemplateTier) : null;

/** Overrides stored in `template_settings`, cached briefly because every save checks them. */
@Injectable()
export class PrismaTemplateCatalog implements TemplateCatalog {
  private cache: { at: number; rows: TemplateSettingDto[] } | null = null;

  constructor(@Inject(DB) private readonly db: DbClient) {}

  async settings(): Promise<TemplateSettingDto[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.rows;
    const rows = (await this.db.templateSetting.findMany()).map((r) => ({
      templateId: r.templateId,
      enabled: r.enabled,
      tier: asTier(r.tier),
      sortOrder: r.sortOrder,
    }));
    this.cache = { at: Date.now(), rows };
    return rows;
  }

  async tierOf(id: TemplateId): Promise<TemplateTier> {
    const row = (await this.settings()).find((r) => r.templateId === id);
    return row?.tier ?? templateMeta(id).tier;
  }

  async update(id: TemplateId, dto: UpdateTemplateSettingDto): Promise<TemplateSettingDto> {
    const row = await this.db.templateSetting.upsert({
      where: { templateId: id },
      update: dto,
      create: { templateId: id, enabled: dto.enabled ?? true, tier: dto.tier ?? null, sortOrder: dto.sortOrder ?? null },
    });
    this.cache = null;
    return { templateId: row.templateId, enabled: row.enabled, tier: asTier(row.tier), sortOrder: row.sortOrder };
  }
}
