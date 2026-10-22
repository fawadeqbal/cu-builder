"use client";

import type { OrgDto } from "@cvb/contracts";
import { TEMPLATES } from "@cvb/templates/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { orgKeys } from "@/lib/orgs";
import { PLAN_LABEL } from "@/lib/plans";
import { Alert, Avatar, Button, Card, Icon, ProgressBar, Select, TextField, buttonClass } from "@cvb/ui";

const MAX_LOGO = 200_000;

/** Name, sign-in domains, agency branding, seats. */
export function SettingsTab({ org }: { org: OrgDto }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [domains, setDomains] = useState(org.ssoDomains.join(", "));
  const [template, setTemplate] = useState(org.defaultTemplateId ?? "");
  const [brandName, setBrandName] = useState(org.branding.productName ?? "");
  const [logo, setLogo] = useState(org.branding.logoUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api.patch<OrgDto>(`/orgs/${org.id}`, {
        name: name.trim(),
        ssoDomains: domains.split(/[\s,;]+/).filter(Boolean),
        ...(org.kind !== "university"
          ? { defaultTemplateId: template || null, brandName: brandName.trim(), brandLogoUrl: logo }
          : {}),
      }),
    onSuccess: (o) => {
      qc.setQueryData(orgKeys.org(org.id), o);
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
      setDomains(o.ssoDomains.join(", "));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/orgs/${org.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
      router.replace("/org");
    },
  });

  async function pickLogo(file: File | undefined) {
    setLogoError("");
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type))
      return setLogoError("Use a PNG, JPEG, WebP or SVG image.");
    if (file.size > MAX_LOGO) return setLogoError("Keep the logo under 200 KB.");
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href={`/org/${org.id}/branding`} className="cvb-card cvb-card-interactive flex items-center gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-soft text-brand-ink">
          <Icon name="globe" size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="cvb-h3 text-ink">White label</span>
          <span className="text-ink-2">Your logo, colours, templates and your own domain.</span>
        </span>
        <Icon name="chevron-right" size={20} className="shrink-0 text-ink-3" />
      </Link>
      <form onSubmit={submit}>
        <Card
          title="Organisation"
          footer={
            <>
              {saved && (
                <span className="me-auto flex items-center gap-1 text-sm text-success" role="status">
                  <Icon name="check" size={16} /> Saved
                </span>
              )}
              <Button type="submit" variant="primary" loading={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <TextField
            id="s-name"
            label="Name"
            value={name}
            minLength={2}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            id="s-domains"
            label="Email domains for single sign-on"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder="uni.edu.pk, students.uni.edu.pk"
            hint={`People who sign in with Google or Microsoft using one of these domains join as ${org.kind === "agency" ? "members" : "students"} while seats last.`}
          />
          {org.kind !== "university" && (
            <>
              <Select
                id="s-template"
                label="Template for candidate CVs"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="">Classic</option>
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <TextField
                id="s-brand"
                label="Name shown above candidate CVs"
                value={brandName}
                maxLength={80}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder={org.name}
              />
              <div className="cvb-field">
                <span className="cvb-label">Logo</span>
                <div className="flex flex-wrap items-center gap-3">
                  {logo && <Avatar name="Logo preview" src={logo} shape="square" size="lg" />}
                  <label className={buttonClass({ size: "sm" })}>
                    <Icon name="upload" size={16} />
                    {logo ? "Change logo" : "Choose logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      aria-label="Logo file"
                      className="sr-only"
                      onChange={(e) => void pickLogo(e.target.files?.[0])}
                    />
                  </label>
                  {logo && (
                    <Button variant="ghost" size="sm" icon="trash" onClick={() => setLogo("")}>
                      Remove
                    </Button>
                  )}
                </div>
                {logoError && (
                  <span className="cvb-error" role="alert">
                    <Icon name="alert-triangle" size={14} /> {logoError}
                  </span>
                )}
              </div>
            </>
          )}
          {save.error && <Alert tone="danger">{save.error.message}</Alert>}
        </Card>
      </form>

      <Card title="Seats">
        <ProgressBar
          value={org.seatsUsed}
          max={Math.max(org.seats, 1)}
          label="Seats used"
          valueLabel={`${org.seatsUsed} of ${org.seats}`}
        />
        <p className="text-ink-2">
          {org.seatsUsed} of {org.seats} seats used. Each seat gives a {org.kind === "agency" ? "recruiter" : "student"}{" "}
          the {PLAN_LABEL[org.seatPlan]} plan while they belong to {org.name}.
        </p>
        <p className="cvb-caption">To add seats, contact us; staff (owners, admins, reviewers) don&apos;t use seats.</p>
      </Card>

      {org.role === "owner" && (
        <Card as="div">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="cvb-h3 text-ink">Delete organisation</h2>
              <p className="text-ink-3">Members keep their own accounts and CVs.</p>
            </div>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => window.confirm(`Delete ${org.name}?`) && remove.mutate()}
            >
              Delete
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
