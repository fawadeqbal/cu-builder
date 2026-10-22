import { isDiscoverable } from "@cvb/domain";
import type {
  TalentFilter,
  TalentListingRecord,
  TalentProfileInput,
  TalentProfileRecord,
  TalentResumeRecord,
  TalentStore,
} from "./talent.store.js";

type Resume = TalentResumeRecord & { userId: string; deleted: boolean };
type User = { id: string; name: string; email: string; blocked: boolean };
type Contact = { id: string; orgId: string; senderId: string; profileId: string; message: string; createdAt: Date };
type Row = TalentProfileRecord & { searchText: string; syncedAt: Date };

/** Test double with the same visibility rules as the Prisma adapter. */
export class InMemoryTalentStore implements TalentStore {
  users = new Map<string, User>();
  resumes = new Map<string, Resume>();
  orgNames = new Map<string, string>();
  profiles: Row[] = [];
  contacts: Contact[] = [];
  private seq = 0;

  private listing(p: Row): TalentListingRecord | null {
    const resume = p.resumeId ? this.resumes.get(p.resumeId) : undefined;
    const user = this.users.get(p.userId);
    const ok = isDiscoverable({ visible: p.visible, resumeDeleted: !resume || resume.deleted, userBlocked: !user || user.blocked });
    if (!ok || !resume) return null;
    const { searchText: _s, syncedAt: _t, ...record } = p;
    return { ...record, resumeId: resume.id, resumeUpdatedAt: resume.updatedAt };
  }

  async profileFor(userId: string) {
    const p = this.profiles.find((x) => x.userId === userId);
    if (!p) return null;
    const { searchText: _s, syncedAt: _t, ...record } = p;
    return record;
  }

  async saveProfile(userId: string, input: TalentProfileInput) {
    const existing = this.profiles.find((x) => x.userId === userId);
    const row: Row = { id: existing?.id ?? `tp${++this.seq}`, userId, ...input, updatedAt: new Date(), syncedAt: new Date() };
    this.profiles = [...this.profiles.filter((x) => x.userId !== userId), row];
    const { searchText: _s, syncedAt: _t, ...record } = row;
    return record;
  }

  async deleteProfile(userId: string) {
    const p = this.profiles.find((x) => x.userId === userId);
    this.profiles = this.profiles.filter((x) => x.userId !== userId);
    if (p) this.contacts = this.contacts.filter((c) => c.profileId !== p.id);
  }

  async ownResume(userId: string, resumeId: string) {
    const r = this.resumes.get(resumeId);
    return r && r.userId === userId && !r.deleted ? r : null;
  }

  async staleListings(limit: number) {
    return this.profiles
      .filter((p) => this.listing(p) && this.resumes.get(p.resumeId!)!.updatedAt > p.syncedAt)
      .slice(0, limit)
      .map((p) => ({ ...(this.listing(p) as TalentListingRecord), resumeData: this.resumes.get(p.resumeId!)!.data }));
  }

  async reindex(id: string, input: Pick<TalentProfileInput, "titles" | "skills" | "searchText">) {
    const p = this.profiles.find((x) => x.id === id);
    if (p) Object.assign(p, input, { syncedAt: new Date() });
  }

  async search(filter: TalentFilter) {
    const place = filter.location?.toLowerCase();
    const role = filter.role?.toLowerCase();
    return this.profiles
      .filter((p) => filter.terms.every((t) => p.searchText.includes(t)))
      .filter((p) => !place || p.location.toLowerCase().includes(place))
      .filter((p) => !role || p.searchText.includes(role))
      .map((p) => this.listing(p))
      .filter((p): p is TalentListingRecord => p !== null)
      .sort((a, b) => +b.resumeUpdatedAt - +a.resumeUpdatedAt)
      .slice(0, filter.take);
  }

  async findListing(id: string) {
    const p = this.profiles.find((x) => x.id === id);
    const l = p && this.listing(p);
    if (!l) return null;
    const user = this.users.get(l.userId)!;
    return { ...l, resume: this.resumes.get(l.resumeId)!, user: { name: user.name, email: user.email } };
  }

  async sentSince(senderId: string, since: Date) {
    return this.contacts.filter((c) => c.senderId === senderId && c.createdAt > since).map((c) => c.createdAt);
  }

  async lastContact(orgId: string, profileId: string) {
    const times = this.contacts.filter((c) => c.orgId === orgId && c.profileId === profileId).map((c) => +c.createdAt);
    return times.length ? new Date(Math.max(...times)) : null;
  }

  async addContact(input: { orgId: string; senderId: string; profileId: string; message: string }) {
    const c = { id: `tc${++this.seq}`, createdAt: new Date(), ...input };
    this.contacts.push(c);
    return { id: c.id, createdAt: c.createdAt };
  }

  async contactsFor(profileId: string, limit: number) {
    return this.contacts
      .filter((c) => c.profileId === profileId)
      .sort((a, b) => +b.createdAt - +a.createdAt)
      .slice(0, limit)
      .map((c) => ({ orgName: this.orgNames.get(c.orgId) ?? "", senderName: this.users.get(c.senderId)?.name ?? "", createdAt: c.createdAt }));
  }

  async contactLog(orgId: string, limit: number) {
    return this.contacts
      .filter((c) => c.orgId === orgId)
      .sort((a, b) => +b.createdAt - +a.createdAt)
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        profileId: c.profileId,
        headline: this.profiles.find((p) => p.id === c.profileId)?.headline ?? "",
        senderName: this.users.get(c.senderId)?.name ?? "",
        message: c.message,
        createdAt: c.createdAt,
      }));
  }

  async userContact(userId: string) {
    const u = this.users.get(userId);
    return u ? { name: u.name, email: u.email } : null;
  }
}
