import {
  CompleteOrderSchema,
  CreateOrderSchema,
  DeliverSchema,
  DisputeSchema,
  ExpertProfileBodySchema,
  ExpertStatusSchema,
  IdParamSchema,
  PostMessageSchema,
  RefundSchema,
  ResolveDisputeSchema,
  RevisionSchema,
  SessionNotesSchema,
  type CreateOrderDto,
  type ExpertProfileBodyDto,
  type ResolveDisputeDto,
} from "@cvb/contracts";
import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Public, Roles } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { ExpertsService } from "./experts.service.js";
import { OrdersService } from "./orders.service.js";

type Id = { id: string };
const id = new ZodPipe(IdParamSchema);

/** The public side: the service catalogue and the expert directory. */
@Controller()
export class ExpertsController {
  constructor(
    private readonly experts: ExpertsService,
    private readonly orders: OrdersService,
  ) {}

  @Public()
  @Get("services/catalog")
  catalog() {
    return this.orders.catalog();
  }

  @Get("services/included")
  async included(@CurrentUser() user: AuthUser) {
    return { available: await this.orders.includedAvailable(user) };
  }

  @Public()
  @Get("experts")
  directory(@Query("service") service?: string, @Query("language") language?: string, @Query("q") q?: string) {
    return this.experts.directory({ service: service?.slice(0, 20), language: language?.slice(0, 40), q: q?.slice(0, 80) });
  }

  @Public()
  @Get("experts/:id")
  profile(@Param(id) { id: expertId }: Id) {
    return this.experts.profile(expertId);
  }

  @Public()
  @Get("experts/:id/slots")
  slots(@Param(id) { id: expertId }: Id, @Query("duration") duration?: string) {
    return this.experts.slots(expertId, Number(duration) || 60);
  }

  @Get("expert/me")
  async me(@CurrentUser() user: AuthUser) {
    return { profile: await this.experts.me(user) };
  }

  @Put("expert/me")
  save(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ExpertProfileBodySchema)) dto: ExpertProfileBodyDto) {
    return this.experts.save(user, dto);
  }

  @Get("expert/orders")
  assigned(@CurrentUser() user: AuthUser) {
    return this.orders.assigned(user);
  }

  @Post("expert/payouts/connect")
  @HttpCode(200)
  connect(@CurrentUser() user: AuthUser) {
    return this.experts.connectPayouts(user);
  }

  @Post("expert/payouts/refresh")
  @HttpCode(200)
  refresh(@CurrentUser() user: AuthUser) {
    return this.experts.refreshPayouts(user);
  }
}

/** Orders, for the buyer and the assigned expert. */
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateOrderSchema)) dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.mine(user);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param(id) p: Id) {
    return this.orders.get(user, p.id);
  }

  @Get(":id/messages")
  messages(@CurrentUser() user: AuthUser, @Param(id) p: Id) {
    return this.orders.messages(user, p.id);
  }

  @Post(":id/messages")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  post(@CurrentUser() user: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(PostMessageSchema)) { body }: { body: string }) {
    return this.orders.postMessage(user, p.id, body);
  }

  @Get(":id/calendar")
  @Header("content-type", "text/calendar; charset=utf-8")
  async calendar(@CurrentUser() user: AuthUser, @Param(id) p: Id, @Res({ passthrough: true }) res: Response) {
    res.setHeader("content-disposition", `attachment; filename="coaching-${p.id}.ics"`);
    return this.orders.calendar(user, p.id);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param(id) p: Id) {
    return this.orders.cancel(user, p.id);
  }

  @Post(":id/start")
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param(id) p: Id) {
    return this.orders.start(user, p.id);
  }

  @Post(":id/deliver")
  @HttpCode(200)
  deliver(@CurrentUser() user: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(DeliverSchema)) { note }: { note: string }) {
    return this.orders.deliver(user, p.id, note);
  }

  @Put(":id/notes")
  notes(@CurrentUser() user: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(SessionNotesSchema)) { notes }: { notes: string }) {
    return this.orders.saveNotes(user, p.id, notes);
  }

  @Post(":id/complete")
  @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(CompleteOrderSchema)) dto: { rating: number; comment: string }) {
    return this.orders.complete(user, p.id, dto.rating, dto.comment);
  }

  @Post(":id/revision")
  @HttpCode(200)
  revision(@CurrentUser() user: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(RevisionSchema)) { request }: { request: string }) {
    return this.orders.requestRevision(user, p.id, request);
  }

  @Post(":id/dispute")
  @HttpCode(200)
  dispute(@CurrentUser() user: AuthUser, @Param(id) p: Id, @Body(new ZodPipe(DisputeSchema)) { reason }: { reason: string }) {
    return this.orders.dispute(user, p.id, reason);
  }
}

const AssignSchema = z.object({ expertId: z.string().min(1).max(64) });

/** Marketplace operations: expert approval, refunds, disputes, manual assignment, payouts. */
@Roles("admin")
@Controller("admin")
export class ServicesAdminController {
  constructor(
    private readonly experts: ExpertsService,
    private readonly orders: OrdersService,
  ) {}

  @Get("experts")
  listExperts() {
    return this.experts.adminList();
  }

  @Patch("experts/:id")
  setStatus(@Param(id) p: Id, @Body(new ZodPipe(ExpertStatusSchema)) { status }: { status: "approved" | "suspended" | "pending" }) {
    return this.experts.setStatus(p.id, status);
  }

  @Get("orders")
  list(@Query("status") status?: string) {
    return this.orders.all(status?.slice(0, 30) || undefined);
  }

  @Post("orders/:id/refund")
  @HttpCode(200)
  refund(@Param(id) p: Id, @Body(new ZodPipe(RefundSchema)) dto: { amountCents?: number; reason: string }) {
    return this.orders.refund(p.id, dto);
  }

  @Post("orders/:id/resolve")
  @HttpCode(200)
  resolve(@Param(id) p: Id, @Body(new ZodPipe(ResolveDisputeSchema)) dto: ResolveDisputeDto) {
    return this.orders.resolveDispute(p.id, dto);
  }

  @Post("orders/:id/assign")
  @HttpCode(200)
  assign(@Param(id) p: Id, @Body(new ZodPipe(AssignSchema)) { expertId }: { expertId: string }) {
    return this.orders.assign(p.id, expertId);
  }

  @Post("orders/:id/payout")
  @HttpCode(200)
  payout(@Param(id) p: Id) {
    return this.orders.releasePayout(p.id);
  }
}
