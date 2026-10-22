"use client";

import type { BrandingDto, OrgBrandingDto } from "@cvb/contracts";
import { brandCssVariables, brandCssVariablesDark, isHexColor, readableWithWhite } from "@cvb/domain";
import { TEMPLATES } from "@cvb/templates/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import {
  Alert,
  Avatar,
  BackLink,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  LogoMark,
  PageHeader,
  Skeleton,
  TextField,
  buttonClass,
} from "@cvb/ui";
import { api, isApiError } from "@/lib/api";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { DomainSetup } from "./DomainSetup";

const MAX_LOGO = 100 * 1024;
const key = (orgId: string) => ["orgs", orgId, "branding"] as const;

/** White label for a partner: name, logo, colours, templates offered, and the partner's own domain. */
export function BrandingEditor({ orgId }: { orgId: string }) {
  const data = useQuery({
    queryKey: key(orgId),
    queryFn: () => api.get<OrgBrandingDto>(`/orgs/${orgId}/branding`),
    retry: false,
  });
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
            {data.isLoading ? (
              <>
                <BackLink href={`/org/${orgId}`}>Organisation</BackLink>
                <Skeleton width={240} height={34} />
                <Skeleton height={320} shape="block" />
              </>
            ) : data.data ? (
              <Form key={data.data.orgId} org={data.data} />
            ) : (
              <>
                <BackLink href={`/org/${orgId}`}>Organisation</BackLink>
                <Card>
                  <EmptyState
                    icon="lock"
                    title={
                      isApiError(data.error, "FORBIDDEN")
                        ? "Only owners and admins can change branding."
                        : "This organisation isn't available."
                    }
                  />
                </Card>
              </>
            )}
          </main>
        </div>
      )}
    </RequireAuth>
  );
}

function Form({ org }: { org: OrgBrandingDto }) {
  const qc = useQueryClient();
  const [b, setB] = useState<BrandingDto>(org.branding);
  const [logoError, setLogoError] = useState("");
  const save = useMutation({
    mutationFn: () => api.put<OrgBrandingDto>(`/orgs/${org.orgId}/branding`, b),
    onSuccess: (d) => qc.setQueryData(key(org.orgId), d),
  });
  const setOrg = (d: OrgBrandingDto) => qc.setQueryData(key(org.orgId), d);
  const set = <K extends keyof BrandingDto>(k: K, v: BrandingDto[K]) => setB((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(b) !== JSON.stringify(org.branding);
  const lowContrast = isHexColor(b.primaryColor) && !readableWithWhite(b.primaryColor);

  function pickLogo(file: File | undefined) {
    setLogoError("");
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return setLogoError("Use a PNG, JPEG, WebP or SVG image");
    if (file.size > MAX_LOGO) return setLogoError("Use a logo under 100 KB");
    const reader = new FileReader();
    reader.onload = () => set("logoUrl", String(reader.result));
    reader.readAsDataURL(file);
  }

  const color = (k: "primaryColor" | "accentColor", title: string, hint: string) => (
    <div className="cvb-field">
      <label className="cvb-label" htmlFor={`b-${k}`}>
        {title}
      </label>
      <div className="flex items-center gap-2">
        {/* A colour picker: its value is the partner's colour (data), not an interface colour. */}
        <input
          type="color"
          aria-label={`${title} picker`}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-line-control bg-surface p-1"
          value={isHexColor(b[k]) ? b[k] : "#004494"}
          onChange={(e) => set(k, e.target.value)}
        />
        <TextField
          id={`b-${k}`}
          dir="ltr"
          className="min-w-0 flex-1"
          inputClassName="font-mono"
          placeholder="Default"
          value={b[k]}
          maxLength={7}
          onChange={(e) => set(k, e.target.value.trim())}
        />
      </div>
      <span className="cvb-hint">{hint}</span>
    </div>
  );

  const product = b.productName || (b.hideBrand ? org.orgName : "CV Builder");
  const accent = b.accentColor || "var(--appbar-accent)";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { href: "/org", label: "Organisations" },
          { href: `/org/${org.orgId}`, label: org.orgName },
          { label: "Branding" },
        ]}
        title="Branding"
        description={`How the app looks for ${org.orgName}'s people on your own domain.`}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Name, logo and colours">
            <TextField
              id="b-name"
              label="Product name"
              maxLength={60}
              placeholder={`${org.orgName} Careers`}
              value={b.productName}
              onChange={(e) => set("productName", e.target.value)}
            />
            <div className="cvb-field">
              <span className="cvb-label" id="b-logo-label">
                Logo
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {b.logoUrl && <Avatar name="Logo" src={b.logoUrl} shape="square" size="lg" />}
                <label className={buttonClass({ size: "sm" })}>
                  <Icon name="upload" size={16} />
                  {b.logoUrl ? "Change logo" : "Choose logo"}
                  <input
                    id="b-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    aria-labelledby="b-logo-label"
                    onChange={(e) => pickLogo(e.target.files?.[0])}
                  />
                </label>
                {b.logoUrl && (
                  <Button variant="ghost" size="sm" icon="trash" onClick={() => set("logoUrl", "")}>
                    Remove
                  </Button>
                )}
              </div>
              {logoError ? (
                <span className="cvb-error" role="alert">
                  <Icon name="alert-triangle" size={14} /> {logoError}
                </span>
              ) : (
                <span className="cvb-hint">PNG, JPEG, WebP or SVG, under 100 KB</span>
              )}
            </div>
            <div className="cvb-field-row">
              {color("primaryColor", "Main colour", "The app bar and main buttons")}
              {color("accentColor", "Accent colour", "Highlights, like the current page")}
            </div>
            {lowContrast && (
              <Alert tone="warning">
                White text is hard to read on this main colour. Pick a darker shade so buttons stay readable.
              </Alert>
            )}
            <Checkbox
              label="Hide “CV Builder” mentions"
              checked={b.hideBrand}
              onChange={(e) => set("hideBrand", e.target.checked)}
            />
          </Card>

          <Card title="Templates offered" description="Leave all unticked to offer every template.">
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <Checkbox
                  key={t.id}
                  label={t.name}
                  checked={b.templateIds.includes(t.id)}
                  onChange={(e) =>
                    set(
                      "templateIds",
                      e.target.checked ? [...b.templateIds, t.id] : b.templateIds.filter((x) => x !== t.id),
                    )
                  }
                />
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {save.error && <Alert tone="danger">{save.error.message}</Alert>}
            {save.isSuccess && !dirty && (
              <span className="flex items-center gap-1 text-sm text-success" role="status">
                <Icon name="check" size={16} /> Saved
              </span>
            )}
            <Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save branding"}
            </Button>
          </div>

          <Card title="Your domain" description="People who open the app on this domain see your branding.">
            <DomainSetup
              status={org.customDomain}
              example="careers.your-university.edu"
              onSave={async (domain) =>
                setOrg(await api.put<OrgBrandingDto>(`/orgs/${org.orgId}/branding/domain`, { domain }))
              }
              onVerify={async () => setOrg(await api.post<OrgBrandingDto>(`/orgs/${org.orgId}/branding/domain/verify`))}
            />
          </Card>
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-6" aria-label="Preview">
          <span className="cvb-overline">Preview</span>
          <BrandPreview
            theme="light"
            vars={brandCssVariables(b)}
            logoUrl={b.logoUrl}
            product={product}
            accent={accent}
          />
          <BrandPreview
            theme="dark"
            vars={brandCssVariablesDark(b)}
            logoUrl={b.logoUrl}
            product={product}
            accent={accent}
          />
          <p className="cvb-caption">The app bar and buttons in the light and dark themes.</p>
        </aside>
      </div>
    </>
  );
}

/** A small mock of the app bar and buttons, themed with the partner's colours. */
function BrandPreview({
  theme,
  vars,
  logoUrl,
  product,
  accent,
}: {
  theme: "light" | "dark";
  vars: Record<string, string>;
  logoUrl: string;
  product: string;
  accent: string;
}) {
  return (
    <div
      data-theme={theme}
      style={vars as CSSProperties}
      className="overflow-hidden rounded-lg border border-line bg-canvas text-ink"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 border-b border-[var(--appbar-line)] bg-[var(--appbar-bg)] px-4 py-3 [&_.cvb-logo-line]:stroke-[var(--appbar-bg)] [&_.cvb-logo-page]:fill-[var(--appbar-ink)]">
        <LogoMark size={24} src={logoUrl || null} />
        <span className="min-w-0 truncate font-display text-sm font-bold text-[var(--appbar-ink)]">{product}</span>
        <span
          className="ms-auto border-b-2 pb-0.5 text-xs font-semibold text-[var(--appbar-ink)]"
          style={{ borderColor: accent }}
        >
          My CVs
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
          <div className="h-2 w-28 rounded-full bg-ink-3" />
          <div className="h-2 w-40 rounded-full bg-surface-3" />
          <div className="h-2 w-32 rounded-full bg-surface-3" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={buttonClass({ variant: "primary", size: "sm" })}>Create my CV</span>
          <span className={buttonClass({ variant: "secondary", size: "sm" })}>Sign in</span>
          <span className={buttonClass({ variant: "link", size: "sm" })}>Pricing</span>
        </div>
        <span className="cvb-caption">{theme === "light" ? "Light" : "Dark"}</span>
      </div>
    </div>
  );
}
