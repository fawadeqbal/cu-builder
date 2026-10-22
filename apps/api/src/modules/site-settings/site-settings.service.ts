import type { SiteSettingsDto, UpdateSiteSettingsDto } from "@cvb/contracts";
import { normalizeWhatsappNumber, WHATSAPP_MESSAGE_MAX } from "@cvb/domain";
import { ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import { SITE_SETTINGS_REPOSITORY, type SiteSettingsRepository } from "./site-settings.repository.js";

const KEYS = { whatsappNumber: "whatsapp.number", whatsappMessage: "whatsapp.message" } as const;
const CACHE_MS = 60_000;

/** Site-wide settings from the admin console (the WhatsApp help number). Read on every page, so cached briefly. */
@Injectable()
export class SiteSettingsService {
  private cache: { at: number; value: SiteSettingsDto } | null = null;

  constructor(
    @Inject(SITE_SETTINGS_REPOSITORY) private readonly repo: SiteSettingsRepository,
    private readonly clock: () => number = Date.now,
  ) {}

  async get(): Promise<SiteSettingsDto> {
    if (this.cache && this.clock() - this.cache.at < CACHE_MS) return this.cache.value;
    const rows = await this.repo.getAll();
    const value: SiteSettingsDto = {
      whatsappNumber: normalizeWhatsappNumber(rows[KEYS.whatsappNumber] ?? "") ?? "",
      whatsappMessage: (rows[KEYS.whatsappMessage] ?? "").slice(0, WHATSAPP_MESSAGE_MAX),
    };
    this.cache = { at: this.clock(), value };
    return value;
  }

  async update(dto: UpdateSiteSettingsDto): Promise<SiteSettingsDto> {
    const number = dto.whatsappNumber.trim() ? normalizeWhatsappNumber(dto.whatsappNumber) : "";
    if (number === null) throw new ValidationError("Use the full international WhatsApp number, like +92 300 1234567");
    await this.repo.setMany({
      [KEYS.whatsappNumber]: number,
      [KEYS.whatsappMessage]: dto.whatsappMessage.trim().slice(0, WHATSAPP_MESSAGE_MAX),
    });
    this.cache = null;
    return this.get();
  }
}
