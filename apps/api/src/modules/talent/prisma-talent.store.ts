import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma } from "@cvb/db";
import type { TalentShare } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type {
  TalentFilter,
  TalentListingRecord,
  TalentProfileInput,
  TalentProfileRecord,
  TalentResumeRecord,
  TalentStore,
} from "./talent.store.js";

type ProfileRow = {
  id: string;
  userId: string;
  resumeId: string | null;
  visible: boolean;
  headline: string;
  location: string;
  roles: string[];
  share: string;
  titles: string[];
  skills: string[];
  updatedAt: Date;
};

const toRecord = (p: ProfileRow): TalentProfileRecord => ({
  id: p.id,
  userId: p.userId,
  resumeId: p.resumeId,
  visible: p.visible,
  headline: p.headline,
  location: p.location,
  roles: p.roles,
  share: (p.share === "full" ? "full" : "summary") as TalentShare,
  titles: p.titles,
  skills: p.skills,
  updatedAt: p.updatedAt,
});

/** Switched on, with a CV that isn't in the bin, on an account in good standing. */
const DISCOVERABLE = {
  visible: true,
  resume: { is: { deletedAt: null } },
  user: { is: { deletedAt: null, OR: [{ banned: null }, { banned: false }] } },
} satisfies Prisma.TalentProfileWhereInput;

const RESUME_SELECT = { id: true, data: true, templateId: true, accent: true, updatedAt: true } as const;

@Injectable()
export class PrismaTalentStore implements TalentStore {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async profileFor(userId: string) {
    const p = await this.db.talentProfile.findUnique({ where: { userId } });
    return p ? toRecord(p) : null;
  }

  async saveProfile(userId: string, input: TalentProfileInput) {
    const data = { ...input, syncedAt: new Date() };
    const p = await this.db.talentProfile.upsert({ where: { userId }, update: data, create: { ...data, userId } });
    return toRecord(p);
  }

  async deleteProfile(userId: string) {
    await this.db.talentProfile.deleteMany({ where: { userId } });
  }

  async ownResume(userId: string, resumeId: string): Promise<TalentResumeRecord | null> {
    return this.db.resume.findFirst({ where: { id: resumeId, userId, deletedAt: null }, select: RESUME_SELECT });
  }

  async staleListings(limit: number) {
    // Comparing two tables' columns needs SQL; everything else goes through the client.
    const ids = await this.db.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM talent_profiles p JOIN resumes r ON r.id = p.resume_id
      WHERE p.visible AND r.deleted_at IS NULL AND r.updated_at > p.synced_at
      LIMIT ${limit}`;
    if (!ids.length) return [];
    const rows = await this.db.talentProfile.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: { resume: { select: { data: true } } },
    });
    return rows.map((r) => ({ ...toRecord(r), resumeData: r.resume?.data ?? null }));
  }

  async reindex(id: string, input: Pick<TalentProfileInput, "titles" | "skills" | "searchText">) {
    // updatedAt is the person's own change; reindexing only moves syncedAt.
    await this.db.$executeRaw`
      UPDATE talent_profiles SET titles = ${input.titles}, skills = ${input.skills},
        search_text = ${input.searchText}, synced_at = NOW()
      WHERE id = ${id}`;
  }

  async search(filter: TalentFilter): Promise<TalentListingRecord[]> {
    const rows = await this.db.talentProfile.findMany({
      where: {
        ...DISCOVERABLE,
        AND: [
          ...filter.terms.map((t) => ({ searchText: { contains: t } })),
          ...(filter.role ? [{ searchText: { contains: filter.role.toLowerCase() } }] : []),
          ...(filter.location ? [{ location: { contains: filter.location, mode: "insensitive" as const } }] : []),
        ],
      },
      include: { resume: { select: { id: true, updatedAt: true } } },
      orderBy: { resume: { updatedAt: "desc" } },
      take: filter.take,
    });
    return rows.flatMap((r) => (r.resume ? [{ ...toRecord(r), resumeId: r.resume.id, resumeUpdatedAt: r.resume.updatedAt }] : []));
  }

  async findListing(id: string) {
    const r = await this.db.talentProfile.findFirst({
      where: { id, ...DISCOVERABLE },
      include: { resume: { select: RESUME_SELECT }, user: { select: { name: true, email: true } } },
    });
    if (!r?.resume) return null;
    return { ...toRecord(r), resumeId: r.resume.id, resumeUpdatedAt: r.resume.updatedAt, resume: r.resume, user: r.user };
  }

  async sentSince(senderId: string, since: Date) {
    const rows = await this.db.talentContact.findMany({ where: { senderId, createdAt: { gt: since } }, select: { createdAt: true } });
    return rows.map((r) => r.createdAt);
  }

  async lastContact(orgId: string, profileId: string) {
    const r = await this.db.talentContact.findFirst({ where: { orgId, profileId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    return r?.createdAt ?? null;
  }

  async addContact(input: { orgId: string; senderId: string; profileId: string; message: string }) {
    return this.db.talentContact.create({ data: input, select: { id: true, createdAt: true } });
  }

  async contactsFor(profileId: string, limit: number) {
    const rows = await this.db.talentContact.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { org: { select: { name: true } }, sender: { select: { name: true } } },
    });
    return rows.map((r) => ({ orgName: r.org.name, senderName: r.sender.name, createdAt: r.createdAt }));
  }

  async contactLog(orgId: string, limit: number) {
    const rows = await this.db.talentContact.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { profile: { select: { headline: true } }, sender: { select: { name: true } } },
    });
    return rows.map((r) => ({ id: r.id, profileId: r.profileId, headline: r.profile.headline, senderName: r.sender.name, message: r.message, createdAt: r.createdAt }));
  }

  async userContact(userId: string) {
    return this.db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  }
}
