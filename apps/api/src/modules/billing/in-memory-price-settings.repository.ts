import type { Currency, OfferId } from "@cvb/domain";
import type { PriceSettingRecord, PriceSettingsRepository } from "./price-settings.repository.js";

/** Test double for the price overrides. */
export class InMemoryPriceSettings implements PriceSettingsRepository {
  rows: PriceSettingRecord[] = [];

  async list(): Promise<PriceSettingRecord[]> {
    return this.rows.map((r) => ({ ...r }));
  }

  async upsert(input: { offer: OfferId; currency: Currency; amount: number; updatedBy: string }): Promise<void> {
    this.rows = this.rows.filter((r) => !(r.offer === input.offer && r.currency === input.currency));
    this.rows.push({ ...input, updatedAt: new Date() });
  }

  async remove(offer: OfferId, currency: Currency): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.offer === offer && r.currency === currency));
    return this.rows.length < before;
  }
}
