/** Persistence port for site-wide key/value settings. */
export interface SiteSettingsRepository {
  getAll(): Promise<Record<string, string>>;
  /** Writes every entry; an empty string removes the key. */
  setMany(entries: Record<string, string>): Promise<void>;
}

export const SITE_SETTINGS_REPOSITORY = Symbol.for("cvb.api.SiteSettingsRepository");

export class InMemorySiteSettingsRepository implements SiteSettingsRepository {
  readonly rows = new Map<string, string>();
  reads = 0;

  async getAll() {
    this.reads++;
    return Object.fromEntries(this.rows);
  }

  async setMany(entries: Record<string, string>) {
    for (const [k, v] of Object.entries(entries)) {
      if (v) this.rows.set(k, v);
      else this.rows.delete(k);
    }
  }
}
