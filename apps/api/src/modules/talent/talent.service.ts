import type {
  TalentContactDto,
  TalentContactLogDto,
  TalentContactResultDto,
  TalentDetailDto,
  TalentProfileDto,
  TalentResultDto,
  TalentSearchQuery,
  TalentSearchResultDto,
  UpdateTalentProfileDto,
} from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import {
  canSearchTalent,
  contactDecision,
  contactsLeft,
  normalizeCV,
  normalizeRoles,
  sharedTalentCV,
  talentMatches,
  talentScore,
  talentSearchText,
  talentSnapshot,
  topSkills,
  searchTerms,
  type TalentListing,
  type TalentQuery,
} from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { ForbiddenError, NotFoundError, RateLimitedError } from "@cvb/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { OrgsService } from "../orgs/orgs.service.js";
import { TALENT_STORE, type TalentListingRecord, type TalentProfileRecord, type TalentStore } from "./talent.store.js";

const DAY = 24 * 3600 * 1000;
/** How many filtered profiles are ranked per search (pages are cut from these). */
const RANK_POOL = 500;
/** Profiles re-indexed per search when their CV changed. */
const REINDEX_BATCH = 50;

const listingOf = (p: Pick<TalentProfileRecord, "headline" | "location" | "roles" | "titles" | "skills">): TalentListing => ({
  headline: p.headline,
  location: p.location,
  roles: p.roles,
  titles: p.titles,
  skills: p.skills,
});

const resultDto = (p: TalentListingRecord, query: TalentQuery = {}): TalentResultDto => ({
  id: p.id,
  headline: p.headline,
  location: p.location,
  roles: p.roles,
  skills: topSkills(p.skills, query),
  share: p.share,
  updatedAt: p.resumeUpdatedAt.toISOString(),
});

/**
 * Opt-in talent search. Job seekers manage their own profile; recruiters in agency
 * organisations search discoverable profiles, read what each person chose to share and write
 * to them by email through the platform (their address is never shown). Messages are limited
 * per member and logged.
 */
@Injectable()
export class TalentService {
  private readonly logger = new Logger(TalentService.name);

  constructor(
    @Inject(TALENT_STORE) private readonly store: TalentStore,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    private readonly orgs: OrgsService,
  ) {}

  // ─── The job seeker's side ────────────────────────────────────────────────

  async profile(user: AuthUser): Promise<TalentProfileDto> {
    const p = await this.store.profileFor(user.id);
    if (!p) return { enabled: false, resumeId: null, headline: "", location: "", roles: [], share: "summary", updatedAt: null, contacts: [] };
    const contacts = await this.store.contactsFor(p.id, 20);
    return {
      enabled: p.visible && Boolean(p.resumeId),
      resumeId: p.resumeId,
      headline: p.headline,
      location: p.location,
      roles: p.roles,
      share: p.share,
      updatedAt: p.updatedAt.toISOString(),
      contacts: contacts.map((c) => ({ orgName: c.orgName, senderName: c.senderName, createdAt: c.createdAt.toISOString() })),
    };
  }

  async saveProfile(user: AuthUser, dto: UpdateTalentProfileDto): Promise<TalentProfileDto> {
    const resume = await this.store.ownResume(user.id, dto.resumeId);
    if (!resume) throw new NotFoundError("CV", dto.resumeId);
    const snapshot = talentSnapshot(normalizeCV(resume.data));
    const roles = normalizeRoles(dto.roles);
    const listing = { headline: dto.headline, location: dto.location, roles, ...snapshot };
    await this.store.saveProfile(user.id, {
      resumeId: resume.id,
      visible: dto.enabled,
      headline: dto.headline,
      location: dto.location,
      roles,
      share: dto.share,
      ...snapshot,
      searchText: talentSearchText(listing),
    });
    return this.profile(user);
  }

  /** Removes the profile and its messages for good (also happens when the account is deleted). */
  async deleteProfile(user: AuthUser): Promise<void> {
    await this.store.deleteProfile(user.id);
  }

  // ─── The recruiter's side ─────────────────────────────────────────────────

  async search(user: AuthUser, orgId: string, query: TalentSearchQuery): Promise<TalentSearchResultDto> {
    await this.recruiterAccess(user, orgId);
    await this.reindexStale();
    const filter: TalentQuery = { q: query.q, location: query.location, role: query.role };
    const pool = await this.store.search({ terms: searchTerms(query.q), location: query.location || undefined, role: query.role || undefined, take: RANK_POOL });
    const ranked = pool
      .filter((p) => talentMatches(listingOf(p), filter))
      .map((p) => ({ p, score: talentScore(listingOf(p), filter) }))
      .sort((a, b) => b.score - a.score || +b.p.resumeUpdatedAt - +a.p.resumeUpdatedAt);
    const offset = query.cursor ?? 0;
    const items = ranked.slice(offset, offset + query.limit).map(({ p }) => resultDto(p, filter));
    const next = offset + query.limit;
    return {
      items,
      nextCursor: next < ranked.length ? next : null,
      contactsLeft: contactsLeft(await this.store.sentSince(user.id, new Date(Date.now() - DAY))),
    };
  }

  async view(user: AuthUser, orgId: string, profileId: string): Promise<TalentDetailDto> {
    await this.recruiterAccess(user, orgId);
    const p = await this.store.findListing(profileId);
    if (!p) throw new NotFoundError("Profile", profileId);
    const last = await this.store.lastContact(orgId, p.id);
    return {
      ...resultDto(p),
      cv: sharedTalentCV(normalizeCV(p.resume.data), p.share, p.location),
      templateId: p.share === "full" ? p.resume.templateId : "classic",
      accent: p.share === "full" ? p.resume.accent : null,
      lastContactedAt: last?.toISOString() ?? null,
    };
  }

  async contact(user: AuthUser, orgId: string, profileId: string, dto: TalentContactDto): Promise<TalentContactResultDto> {
    const { org, member } = await this.recruiterAccess(user, orgId);
    // Site admins can look in; only the organisation's own people write to candidates.
    if (!member) throw new ForbiddenError("Only members of this organisation can contact people");
    const p = await this.store.findListing(profileId);
    if (!p) throw new NotFoundError("Profile", profileId);

    const now = new Date();
    const sent = await this.store.sentSince(user.id, new Date(now.getTime() - DAY));
    const decision = contactDecision({ sentByMember: sent, lastFromOrg: await this.store.lastContact(orgId, p.id), now });
    if (!decision.ok) {
      const when = decision.retryAt.toISOString();
      throw new RateLimitedError(
        decision.reason === "daily_limit"
          ? "You've sent the most messages allowed in 24 hours. Try again later."
          : "Someone in your organisation wrote to this person in the last 7 days.",
        { reason: decision.reason, retryAt: when },
      );
    }

    const sender = (await this.store.userContact(user.id)) ?? { name: user.name, email: user.email };
    const logged = await this.store.addContact({ orgId, senderId: user.id, profileId: p.id, message: dto.message });
    await this.jobs.enqueue(
      QUEUES.email,
      "send",
      {
        template: "talent-contact",
        to: p.user.email,
        name: p.user.name,
        recruiterName: sender.name || sender.email,
        orgName: org.name,
        message: dto.message,
        replyTo: sender.email,
      },
      { jobId: `talent-contact-${logged.id}` },
    );
    this.logger.log(`Talent contact ${logged.id}: org ${orgId}, member ${user.id} → profile ${p.id}`);
    return { contactsLeft: decision.left };
  }

  async contactLog(user: AuthUser, orgId: string): Promise<TalentContactLogDto[]> {
    await this.recruiterAccess(user, orgId);
    const rows = await this.store.contactLog(orgId, 200);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  /** Recruiting staff (owner, admin, recruiter) of an agency; site admins may look in. */
  private async recruiterAccess(user: AuthUser, orgId: string) {
    const access = await this.orgs.access(user, orgId, "candidates.view");
    if (!canSearchTalent(access.org.kind)) throw new ForbiddenError("Talent search is for recruitment agencies");
    return access;
  }

  /** Keeps search in step with CV edits: refreshes titles and skills of profiles whose CV changed. */
  private async reindexStale(): Promise<void> {
    const stale = await this.store.staleListings(REINDEX_BATCH);
    for (const p of stale) {
      const snapshot = talentSnapshot(normalizeCV(p.resumeData));
      await this.store.reindex(p.id, { ...snapshot, searchText: talentSearchText({ ...listingOf(p), ...snapshot }) });
    }
  }
}
