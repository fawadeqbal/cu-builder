import {
  BoardSchema,
  CreateApplicationSchema,
  CreateReminderSchema,
  IdParamSchema,
  MoveApplicationSchema,
  UpdateApplicationSchema,
  UpdateReminderSchema,
  type BoardDto,
  type CreateApplicationDto,
  type MoveApplicationDto,
  type UpdateApplicationDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { TrackerService } from "./tracker.service.js";

const DAY = 86_400_000;

@Controller()
export class TrackerController {
  constructor(private readonly tracker: TrackerService) {}

  @Get("tracker/board")
  board(@CurrentUser() user: AuthUser) {
    return this.tracker.board(user);
  }

  @Put("tracker/board")
  saveBoard(@CurrentUser() user: AuthUser, @Body(new ZodPipe(BoardSchema)) dto: BoardDto) {
    return this.tracker.saveBoard(user, dto);
  }

  @Get("applications")
  list(@CurrentUser() user: AuthUser, @Query("archived") archived?: string) {
    return this.tracker.list(user, archived === "true");
  }

  /** Requests with a personal access token come from the browser extension. */
  @Post("applications")
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateApplicationSchema)) dto: CreateApplicationDto, @Req() req: Request) {
    const fromExtension = /^Bearer cvb_/.test(req.header("authorization") ?? "");
    return this.tracker.create(user, dto, fromExtension ? "extension" : "manual");
  }

  @Get("applications/:id")
  get(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.tracker.get(user, id);
  }

  @Patch("applications/:id")
  update(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(UpdateApplicationSchema)) dto: UpdateApplicationDto) {
    return this.tracker.update(user, id, dto);
  }

  @Post("applications/:id/move")
  @HttpCode(200)
  move(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(MoveApplicationSchema)) dto: MoveApplicationDto) {
    return this.tracker.move(user, id, dto);
  }

  @Post("applications/:id/share-link")
  @HttpCode(200)
  shareLink(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.tracker.shareLink(user, id);
  }

  @Post("applications/:id/brief")
  @HttpCode(200)
  brief(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.tracker.brief(user, id);
  }

  @Delete("applications/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.tracker.remove(user, id);
  }

  @Get("reminders")
  reminders(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    const start = from && !Number.isNaN(Date.parse(from)) ? new Date(from) : new Date(Date.now() - 31 * DAY);
    const end = to && !Number.isNaN(Date.parse(to)) ? new Date(to) : new Date(Date.now() + 62 * DAY);
    return this.tracker.reminders(user, start, end);
  }

  @Post("reminders")
  createReminder(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateReminderSchema)) dto: { title: string; dueAt: string; applicationId?: string }) {
    return this.tracker.createReminder(user, dto);
  }

  @Patch("reminders/:id")
  setDone(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(UpdateReminderSchema)) { done }: { done: boolean }) {
    return this.tracker.setReminderDone(user, id, done);
  }

  @Delete("reminders/:id")
  @HttpCode(204)
  deleteReminder(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.tracker.deleteReminder(user, id);
  }
}
