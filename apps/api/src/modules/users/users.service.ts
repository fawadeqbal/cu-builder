import { QUEUES } from "@cvb/contracts";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { USERS_REPOSITORY, type UserRecord, type UsersRepository } from "./users.repository.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toAuthUser = (u: UserRecord): AuthUser => ({ id: u.id, email: u.email, plan: u.plan });

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
  ) {}

  async findOrCreateByEmail(rawEmail: string): Promise<AuthUser> {
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL.test(email)) throw new ValidationError("That email doesn't look right");

    const existing = await this.users.findByEmail(email);
    if (existing) return toAuthUser(existing);

    const created = await this.users.create({ email });
    await this.jobs.enqueue(
      QUEUES.email,
      "send",
      { template: "welcome", to: created.email, name: created.name ?? "" },
      { jobId: `welcome-${created.id}` },
    );
    return toAuthUser(created);
  }

  async get(id: string): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User", id);
    return user;
  }
}
