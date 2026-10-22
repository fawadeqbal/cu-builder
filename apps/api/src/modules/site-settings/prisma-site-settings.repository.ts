import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { SiteSettingsRepository } from "./site-settings.repository.js";

@Injectable()
export class PrismaSiteSettingsRepository implements SiteSettingsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async getAll() {
    const rows = await this.db.siteSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setMany(entries: Record<string, string>) {
    await this.db.$transaction(
      Object.entries(entries).map(([key, value]) =>
        value
          ? this.db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
          : this.db.siteSetting.deleteMany({ where: { key } }),
      ),
    );
  }
}
