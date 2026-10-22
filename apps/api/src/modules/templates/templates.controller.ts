import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../../common/auth/decorators.js";
import { TEMPLATE_CATALOG, type TemplateCatalog } from "./template-catalog.js";

/** The gallery reads admin overrides (hidden templates, tier changes) without signing in. */
@Controller("templates")
export class TemplatesController {
  constructor(@Inject(TEMPLATE_CATALOG) private readonly catalog: TemplateCatalog) {}

  @Public()
  @Get("settings")
  settings() {
    return this.catalog.settings();
  }
}
