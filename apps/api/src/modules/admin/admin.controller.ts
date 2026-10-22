import {
  AdminUpdateUserSchema,
  AdminUsersQuerySchema,
  IdParamSchema,
  UpdateTemplateSettingSchema,
  type AdminUpdateUserDto,
  type AdminUsersQuery,
  type UpdateTemplateSettingDto,
} from "@cvb/contracts";
import { Body, Controller, Get, HttpCode, Param, Patch, Query } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Roles } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { AdminService } from "./admin.service.js";

@Roles("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("metrics")
  metrics() {
    return this.admin.metrics();
  }

  @Get("users")
  users(@Query(new ZodPipe(AdminUsersQuerySchema)) query: AdminUsersQuery) {
    return this.admin.users(query);
  }

  @Patch("users/:id")
  @HttpCode(204)
  async updateUser(
    @CurrentUser() actor: AuthUser,
    @Param(new ZodPipe(IdParamSchema)) { id }: { id: string },
    @Body(new ZodPipe(AdminUpdateUserSchema)) dto: AdminUpdateUserDto,
  ) {
    await this.admin.updateUser(id, dto, actor.id);
  }

  @Get("templates")
  templates() {
    return this.admin.templateSettings();
  }

  @Patch("templates/:templateId")
  updateTemplate(
    @Param("templateId") templateId: string,
    @Body(new ZodPipe(UpdateTemplateSettingSchema)) dto: UpdateTemplateSettingDto,
  ) {
    return this.admin.updateTemplate(templateId, dto);
  }
}
