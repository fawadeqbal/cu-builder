import type { Currency, OfferId, PriceOverride } from "@cvb/domain";

export type PriceSettingRecord = PriceOverride & {
  updatedAt: Date;
  /** Display name (or email) of the admin who set it, if still known. */
  updatedBy: string | null;
};

/** Persistence port for admin price overrides (one row per offer and currency). */
export interface PriceSettingsRepository {
  list(): Promise<PriceSettingRecord[]>;
  upsert(input: { offer: OfferId; currency: Currency; amount: number; updatedBy: string }): Promise<void>;
  /** Back to the default price; false when there was no override. */
  remove(offer: OfferId, currency: Currency): Promise<boolean>;
}

export const PRICE_SETTINGS = Symbol.for("cvb.api.PriceSettingsRepository");
