import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { OFFER_IDS, isCurrency, type Currency, type OfferId } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { PriceSettingRecord, PriceSettingsRepository } from "./price-settings.repository.js";

const isOffer = (v: string): v is OfferId => (OFFER_IDS as readonly string[]).includes(v);

@Injectable()
export class PrismaPriceSettings implements PriceSettingsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async list(): Promise<PriceSettingRecord[]> {
    const rows = await this.db.priceSetting.findMany();
    const ids = [...new Set(rows.map((r) => r.updatedBy).filter((x): x is string => Boolean(x)))];
    const users = ids.length
      ? await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name || u.email]));
    // Rows for offers or currencies that no longer exist are ignored.
    return rows.flatMap((r) =>
      isOffer(r.offerId) && isCurrency(r.currency)
        ? [{ offer: r.offerId, currency: r.currency, amount: r.amount, updatedAt: r.updatedAt, updatedBy: r.updatedBy ? (names.get(r.updatedBy) ?? null) : null }]
        : [],
    );
  }

  async upsert({ offer, currency, amount, updatedBy }: { offer: OfferId; currency: Currency; amount: number; updatedBy: string }): Promise<void> {
    await this.db.priceSetting.upsert({
      where: { offerId_currency: { offerId: offer, currency } },
      update: { amount, updatedBy },
      create: { offerId: offer, currency, amount, updatedBy },
    });
  }

  async remove(offer: OfferId, currency: Currency): Promise<boolean> {
    const { count } = await this.db.priceSetting.deleteMany({ where: { offerId: offer, currency } });
    return count > 0;
  }
}
