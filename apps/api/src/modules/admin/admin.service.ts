import type {
  AdminMetricsDto,
  AdminUpdateUserDto,
  AdminUserDto,
  AdminUsersQuery,
  Page,
  TemplateSettingDto,
  UpdateTemplateSettingDto,
} from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import { planToDb, planToDomain, type DbClient } from "@cvb/db";
import { effectivePlan } from "@cvb/domain";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { isTemplateId } from "@cvb/templates/catalog";
import { Inject, Injectable } from "@nestjs/common";
import { TEMPLATE_CATALOG, type TemplateCatalog } from "../templates/template-catalog.js";

const DAY = 24 * 3600 * 1000;
const STATUS = { TRIALING: "trialing", ACTIVE: "active", PAST_DUE: "past_due", CANCELED: "canceled", INCOMPLETE: "incomplete" } as const;

/**
 * Read models and admin actions. Reports join across features, so this service queries Prisma
 * directly (a query service) instead of going through each feature's repository.
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(TEMPLATE_CATALOG) private readonly catalog: TemplateCatalog,
  ) {}

  async metrics(): Promise<AdminMetricsDto> {
    const now = new Date();
    const since = new Date(now.getTime() - 7 * DAY);
    const [total, last7Days, resumes, paying, activePasses, funnel] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null } }),
      this.db.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      this.db.resume.count({ where: { deletedAt: null } }),
      this.db.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, currentPeriodEnd: { gt: now } } }),
      this.db.pass.count({ where: { startsAt: { lte: now }, endsAt: { gt: now } } }),
      this.db.analyticsEvent.groupBy({
        by: ["name"],
        where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } },
        _count: { _all: true },
      }),
    ]);
    return {
      users: { total, last7Days },
      resumes,
      paying,
      activePasses,
      funnel: funnel.map((f) => ({ name: f.name, count: f._count._all })).sort((a, b) => b.count - a.count),
    };
  }

  async users({ q, cursor, limit }: AdminUsersQuery): Promise<Page<AdminUserDto>> {
    const rows = await this.db.user.findMany({
      where: {
        deletedAt: null,
        ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        subscriptions: true,
        passes: true,
        _count: { select: { resumes: { where: { deletedAt: null } } } },
      },
    });
    const now = new Date();
    const items = rows.slice(0, limit).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role ?? "user",
      basePlan: planToDomain(u.plan),
      plan: effectivePlan(
        {
          base: planToDomain(u.plan),
          subscriptions: u.subscriptions.map((s) => ({ plan: planToDomain(s.plan), status: STATUS[s.status], currentPeriodEnd: s.currentPeriodEnd })),
          passes: u.passes.map((p) => ({ plan: planToDomain(p.plan), startsAt: p.startsAt, endsAt: p.endsAt })),
        },
        now,
      ).plan,
      banned: Boolean(u.banned),
      resumes: u._count.resumes,
      createdAt: u.createdAt.toISOString(),
    }));
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
  }

  async updateUser(id: string, dto: AdminUpdateUserDto, actorId: string): Promise<void> {
    if (id === actorId && (dto.role === "user" || dto.banned)) throw new ValidationError("You can't demote or ban yourself");
    const exists = await this.db.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundError("User", id);
    await this.db.user.update({
      where: { id },
      data: {
        ...(dto.basePlan ? { plan: planToDb(dto.basePlan) } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.banned !== undefined ? { banned: dto.banned, banReason: dto.banned ? "Banned by an admin" : null } : {}),
      },
    });
    if (dto.banned) await this.db.session.deleteMany({ where: { userId: id } });
  }

  templateSettings(): Promise<TemplateSettingDto[]> {
    return this.catalog.settings();
  }

  updateTemplate(templateId: string, dto: UpdateTemplateSettingDto): Promise<TemplateSettingDto> {
    if (!isTemplateId(templateId)) throw new NotFoundError("Template", templateId);
    return this.catalog.update(templateId, dto);
  }
}
