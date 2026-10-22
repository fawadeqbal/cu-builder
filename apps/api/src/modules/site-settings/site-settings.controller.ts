import { UpdateSiteSettingsSchema, type UpdateSiteSettingsDto } from "@cvb/contracts";
import { Body, Controller, Get, Header, Put } from "@nestjs/common";
import { Public, Roles } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { SiteSettingsService } from "./site-settings.service.js";

@Controller()
export class SiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Public()
  @Get("public/site-settings")
  @Header("cache-control", "public, max-age=60")
  get() {
    return this.settings.get();
  }

  @Roles("admin")
  @Get("admin/site-settings")
  adminGet() {
    return this.settings.get();
  }

  @Roles("admin")
  @Put("admin/site-settings")
  update(@Body(new ZodPipe(UpdateSiteSettingsSchema)) dto: UpdateSiteSettingsDto) {
    return this.settings.update(dto);
  }
}
