import type { TalentShare } from "@cvb/domain";

export type TalentProfileRecord = {
  id: string;
  userId: string;
  resumeId: string | null;
  visible: boolean;
  headline: string;
  location: string;
  roles: string[];
  share: TalentShare;
  titles: string[];
  skills: string[];
  updatedAt: Date;
};

/** A profile recruiters can see right now, with when its CV last changed. */
export type TalentListingRecord = TalentProfileRecord & { resumeId: string; resumeUpdatedAt: Date };

export type TalentResumeRecord = { id: string; data: unknown; templateId: string; accent: string | null; updatedAt: Date };

export type TalentProfileInput = Pick<TalentProfileRecord, "resumeId" | "visible" | "headline" | "location" | "roles" | "share" | "titles" | "skills"> & {
  searchText: string;
};

export type TalentFilter = {
  /** Lower-case terms that must all appear in the profile's search text. */
  terms: string[];
  location?: string;
  role?: string;
  /** Most recently updated first, at most this many. */
  take: number;
};

/**
 * Persistence port for talent profiles and the contact log. Every read for recruiters
 * (`search`, `findListing`) returns discoverable profiles only: switched on, with a CV that
 * isn't in the bin, on an account that isn't suspended.
 */
export interface TalentStore {
  profileFor(userId: string): Promise<TalentProfileRecord | null>;
  saveProfile(userId: string, input: TalentProfileInput): Promise<TalentProfileRecord>;
  deleteProfile(userId: string): Promise<void>;
  /** One of the user's own CVs, not in the bin. */
  ownResume(userId: string, resumeId: string): Promise<TalentResumeRecord | null>;

  /** Discoverable profiles whose CV changed after they were last indexed. */
  staleListings(limit: number): Promise<(TalentProfileRecord & { resumeData: unknown })[]>;
  reindex(id: string, input: Pick<TalentProfileInput, "titles" | "skills" | "searchText">): Promise<void>;

  search(filter: TalentFilter): Promise<TalentListingRecord[]>;
  findListing(id: string): Promise<(TalentListingRecord & { resume: TalentResumeRecord; user: { name: string; email: string } }) | null>;

  /** When a member sent messages through talent search since `since` (any organisation). */
  sentSince(senderId: string, since: Date): Promise<Date[]>;
  /** When anyone in the organisation last wrote to the profile. */
  lastContact(orgId: string, profileId: string): Promise<Date | null>;
  addContact(input: { orgId: string; senderId: string; profileId: string; message: string }): Promise<{ id: string; createdAt: Date }>;
  /** Messages a profile received, newest first. */
  contactsFor(profileId: string, limit: number): Promise<{ orgName: string; senderName: string; createdAt: Date }[]>;
  /** The organisation's sent messages, newest first. */
  contactLog(orgId: string, limit: number): Promise<{ id: string; profileId: string; headline: string; senderName: string; message: string; createdAt: Date }[]>;
  userContact(userId: string): Promise<{ name: string; email: string } | null>;
}

export const TALENT_STORE = Symbol.for("cvb.api.TalentStore");
