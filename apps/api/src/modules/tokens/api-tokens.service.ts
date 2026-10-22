import type { ApiTokenDto, CreatedApiTokenDto } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { AuthUser } from "../../common/auth/auth.types.js";

const PREFIX = "cvb_";
const MAX_TOKENS = 10;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const toDto = (t: { id: string; name: string; prefix: string; lastUsedAt: Date | null; createdAt: Date }): ApiTokenDto => ({
  id: t.id,
  name: t.name,
  prefix: t.prefix,
  lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  createdAt: t.createdAt.toISOString(),
});

/**
 * Personal access tokens for the browser extension. The token is shown once; only its SHA-256
 * is stored, so a database leak doesn't leak working tokens. A small query service: Prisma here
 * is the whole job, there are no rules to keep apart from storage.
 */
@Injectable()
export class ApiTokensService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async list(user: AuthUser): Promise<ApiTokenDto[]> {
    return (await this.db.apiToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })).map(toDto);
  }

  async create(user: AuthUser, name: string): Promise<CreatedApiTokenDto> {
    if ((await this.db.apiToken.count({ where: { userId: user.id } })) >= MAX_TOKENS) throw new ValidationError("Delete an old key first (10 at most)");
    const token = `${PREFIX}${randomBytes(24).toString("base64url")}`;
    const row = await this.db.apiToken.create({ data: { userId: user.id, name, prefix: token.slice(0, 10), tokenHash: hash(token) } });
    return { ...toDto(row), token };
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const { count } = await this.db.apiToken.deleteMany({ where: { id, userId: user.id } });
    if (!count) throw new NotFoundError("Key", id);
  }

  /** The user id behind a bearer token, or null. Records when it was last used (at most hourly). */
  async resolve(token: string): Promise<string | null> {
    if (!token.startsWith(PREFIX) || token.length > 100) return null;
    const row = await this.db.apiToken.findUnique({ where: { tokenHash: hash(token) } });
    if (!row) return null;
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 3600_000) {
      await this.db.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    }
    return row.userId;
  }
}
