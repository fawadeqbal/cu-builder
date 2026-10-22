import type { BrandingDto, DomainStatusDto, HostTargetDto, OrgBrandingDto, PublicBrandingDto } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma } from "@cvb/db";
import { classifyHost, dnsPointsAtUs, isSameOrSubdomain, isValidDomain, normalizeBranding, normalizeDomain } from "@cvb/domain";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { DNS_RESOLVER, type DnsResolver } from "./dns-resolver.js";

const BRANDING_ROLES = ["owner", "admin"];

/**
 * Custom domains for portfolios and white-label partners: validating and verifying them (DNS
 * must point at us), telling Caddy which hosts may get a certificate, and telling the web
 * proxy what a host serves. Also the partner's branding settings.
 */
@Injectable()
export class DomainsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DNS_RESOLVER) private readonly dns: DnsResolver,
  ) {}

  get appHost(): string {
    return new URL(this.config.APP_URL).hostname;
  }

  get portfolioDomain(): string | null {
    return this.config.PORTFOLIO_DOMAIN ? normalizeDomain(this.config.PORTFOLIO_DOMAIN) : null;
  }

  /** Where people point their domain. */
  target(): { host: string; ipv4: string[] } {
    return { host: normalizeDomain(this.config.CUSTOM_DOMAIN_TARGET ?? this.appHost), ipv4: this.config.CUSTOM_DOMAIN_IPV4 };
  }

  status(domain: string | null, verifiedAt: Date | null): DomainStatusDto {
    const t = this.target();
    return { domain, verified: Boolean(domain && verifiedAt), cnameTarget: t.host, ipv4: t.ipv4 };
  }

  /** Normalises a domain someone wants to use and checks it's theirs to claim. */
  async claimable(input: string, owner: { portfolioId?: string; orgId?: string }): Promise<string> {
    const domain = normalizeDomain(input);
    if (!isValidDomain(domain)) throw new ValidationError("Enter a domain like sara.dev or careers.example.edu");
    const ours = [this.appHost, this.portfolioDomain].filter((d): d is string => Boolean(d));
    if (ours.some((d) => isSameOrSubdomain(domain, d))) throw new ValidationError("Use a domain you own");
    const [site, org] = await Promise.all([
      this.db.portfolioSite.findFirst({ where: { customDomain: domain }, select: { id: true } }),
      this.db.organization.findFirst({ where: { customDomain: domain }, select: { id: true } }),
    ]);
    if ((site && site.id !== owner.portfolioId) || (org && org.id !== owner.orgId)) throw new ConflictError("That domain is already connected to another site");
    return domain;
  }

  /** Whether the domain's DNS points at this server now. */
  async pointsAtUs(domain: string): Promise<boolean> {
    const t = this.target();
    const [cnames, ipv4, targetIps] = await Promise.all([
      this.dns.cnames(domain),
      this.dns.ipv4(domain),
      t.ipv4.length ? Promise.resolve(t.ipv4) : this.dns.ipv4(t.host),
    ]);
    return dnsPointsAtUs({ cnames, ipv4 }, { host: t.host, ipv4: targetIps });
  }

  /**
   * Caddy's on-demand TLS check: only hosts we actually serve get a certificate (published
   * portfolio sub-domains and verified custom domains), so nobody can make us request certificates
   * for arbitrary names.
   */
  async allowed(input: string): Promise<boolean> {
    const domain = normalizeDomain(input);
    if (!isValidDomain(domain)) return false;
    if (domain === this.appHost || domain === `www.${this.appHost}`) return true;
    return (await this.resolveHost(domain)).kind !== "none";
  }

  /** What a host serves: a portfolio, a partner's branded app, or nothing we know. */
  async resolveHost(host: string): Promise<HostTargetDto> {
    const kind = classifyHost(host, { appHosts: [this.appHost], portfolioDomain: this.portfolioDomain });
    if (kind.kind === "portfolio") {
      const site = await this.db.portfolioSite.findFirst({ where: { slug: kind.slug, published: true }, select: { slug: true } });
      return site ? { kind: "portfolio", slug: site.slug } : { kind: "none" };
    }
    if (kind.kind !== "custom") return { kind: "none" };
    const site = await this.db.portfolioSite.findFirst({
      where: { customDomain: kind.host, domainVerifiedAt: { not: null }, published: true },
      select: { slug: true },
    });
    if (site) return { kind: "portfolio", slug: site.slug };
    const org = await this.db.organization.findFirst({
      where: { customDomain: kind.host, domainVerifiedAt: { not: null }, deletedAt: null },
      select: { id: true },
    });
    return org ? { kind: "org", orgId: org.id } : { kind: "none" };
  }

  /** A partner's branding for its own domain (the web app restyles itself with it). */
  async publicBranding(host: string): Promise<PublicBrandingDto> {
    const target = await this.resolveHost(host);
    if (target.kind !== "org") return null;
    const org = await this.db.organization.findUnique({ where: { id: target.orgId }, select: { name: true, branding: true } });
    return org ? { ...normalizeBranding(org.branding), orgName: org.name } : null;
  }

  // ─── Partner settings (org owners and admins) ──────────────────────────────

  async orgBranding(user: AuthUser, orgId: string): Promise<OrgBrandingDto> {
    const org = await this.manageable(user, orgId);
    return {
      orgId: org.id,
      orgName: org.name,
      branding: normalizeBranding(org.branding),
      customDomain: this.status(org.customDomain, org.domainVerifiedAt),
    };
  }

  /** Saves branding, keeping keys other features store alongside it. */
  async saveOrgBranding(user: AuthUser, orgId: string, dto: BrandingDto): Promise<OrgBrandingDto> {
    const org = await this.manageable(user, orgId);
    const previous = (org.branding && typeof org.branding === "object" ? org.branding : {}) as Record<string, unknown>;
    const next = { ...previous, ...normalizeBranding(dto) };
    await this.db.organization.update({ where: { id: orgId }, data: { branding: next as Prisma.InputJsonValue } });
    return this.orgBranding(user, orgId);
  }

  async setOrgDomain(user: AuthUser, orgId: string, input: string | null): Promise<OrgBrandingDto> {
    await this.manageable(user, orgId);
    const domain = input ? await this.claimable(input, { orgId }) : null;
    await this.db.organization.update({ where: { id: orgId }, data: { customDomain: domain, domainVerifiedAt: null } });
    return this.orgBranding(user, orgId);
  }

  async verifyOrgDomain(user: AuthUser, orgId: string): Promise<OrgBrandingDto> {
    const org = await this.manageable(user, orgId);
    if (!org.customDomain) throw new ValidationError("Add a domain first");
    const ok = await this.pointsAtUs(org.customDomain);
    await this.db.organization.update({ where: { id: orgId }, data: { domainVerifiedAt: ok ? new Date() : null } });
    return this.orgBranding(user, orgId);
  }

  private async manageable(user: AuthUser, orgId: string) {
    const org = await this.db.organization.findFirst({ where: { id: orgId, deletedAt: null } });
    if (!org) throw new NotFoundError("Organisation", orgId);
    if (user.role === "admin") return org;
    const m = await this.db.membership.findFirst({ where: { orgId, userId: user.id }, select: { role: true } });
    if (!m) throw new NotFoundError("Organisation", orgId);
    if (!BRANDING_ROLES.includes(m.role)) throw new ForbiddenError("Only owners and admins can change branding");
    return org;
  }
}
