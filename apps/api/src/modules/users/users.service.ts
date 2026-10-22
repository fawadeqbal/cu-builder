import type { MeDto, UpdateMeDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import { LIMITS } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { USERS_REPOSITORY, type UserRecord, type UsersRepository } from "./users.repository.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
  ) {}

  /** Development sign-in (x-dev-user). Real sign-up goes through Better Auth. */
  async findOrCreateByEmail(rawEmail: string): Promise<Omit<AuthUser, "plan" | "planSource">> {
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL.test(email)) throw new ValidationError("That email doesn't look right");
    let user = await this.users.findByEmail(email);
    if (!user) {
      user = await this.users.create({ email, name: email.split("@")[0]! });
      await this.jobs.enqueue(
        QUEUES.email,
        "send",
        { template: "welcome", to: user.email, name: user.name },
        { jobId: `welcome-${user.id}` },
      );
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified };
  }

  async get(id: string): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User", id);
    return user;
  }

  async me(auth: AuthUser): Promise<MeDto> {
    const u = await this.get(auth.id);
    const limits = LIMITS[auth.plan];
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
      emailVerified: u.emailVerified,
      locale: u.locale,
      role: u.role,
      plan: auth.plan,
      planSource: auth.planSource,
      limits: { resumes: Number.isFinite(limits.resumes) ? limits.resumes : null, aiCreditsPerMonth: limits.aiCreditsPerMonth },
    };
  }

  async updateMe(auth: AuthUser, patch: UpdateMeDto): Promise<MeDto> {
    await this.users.update(auth.id, patch);
    return this.me(auth);
  }

  exportData(auth: AuthUser): Promise<Record<string, unknown>> {
    return this.users.exportData(auth.id);
  }
}
