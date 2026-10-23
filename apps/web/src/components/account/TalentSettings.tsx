"use client";

import type { TalentProfileDto, UpdateTalentProfileDto } from "@cvb/contracts";
import { TALENT_LIMITS, type TalentShare } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, RadioGroup, Select, Skeleton, Switch, TextField } from "@cvb/ui";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { useResumes } from "@/lib/queries";
import { talentKeys, useTalentProfile } from "@/lib/talent";
import { EditableCard, EditingScope, TagView, ViewRows, useEditingScope } from "../form/editable";
import { Section } from "./AccountLayout";

type Draft = Omit<UpdateTalentProfileDto, "roles"> & { roles: string };

const SHARE_LABEL: Record<TalentShare, string> = {
  summary: "A summary only",
  full: "My full CV",
};

const draftOf = (p: TalentProfileDto | undefined, firstResume: string): Draft => ({
  enabled: p?.enabled ?? false,
  resumeId: p?.resumeId ?? firstResume,
  headline: p?.headline ?? "",
  location: p?.location ?? "",
  roles: (p?.roles ?? []).join(", "),
  share: p?.share ?? "summary",
});

const toDto = (d: Draft): UpdateTalentProfileDto => ({
  ...d,
  headline: d.headline.trim(),
  location: d.location.trim(),
  roles: d.roles
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, TALENT_LIMITS.roles),
});

/**
 * "Let recruiters find me": off by default. Recruitment agencies on CV Builder can then find
 * the person by title, skills and place, read what they chose to share and write to them
 * through us. Their email address is never shown.
 */
export function TalentSettings() {
  const profile = useTalentProfile();
  const resumes = useResumes();
  if (!profile.data || !resumes.data) {
    return (
      <Section title="Let recruiters find me">
        <Skeleton height={96} shape="block" />
      </Section>
    );
  }
  const list = resumes.data.items;
  return (
    <EditingScope>
      <TalentForm
        // Start again from the server copy whenever it changes.
        key={profile.data.updatedAt ?? "new"}
        profile={profile.data}
        resumes={list.map((r) => ({ value: r.id, label: r.title || "Untitled CV" }))}
      />
    </EditingScope>
  );
}

function TalentForm({ profile, resumes }: { profile: TalentProfileDto; resumes: { value: string; label: string }[] }) {
  const qc = useQueryClient();
  const scope = useEditingScope();
  const [draft, setDraft] = useState<Draft>(() => draftOf(profile, resumes[0]?.value ?? ""));
  const [saved, setSaved] = useState<Draft>(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const exists = profile.updatedAt !== null;
  const complete = Boolean(draft.resumeId && draft.headline.trim().length >= 2);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = useMutation({
    mutationFn: (d: Draft) => api.put<TalentProfileDto>("/talent/profile", toDto(d)),
    onSuccess: (data, d) => {
      if (d.enabled && !saved.enabled) track("talent_opt_in", { share: d.share });
      setSaved(d);
      qc.setQueryData(talentKeys.profile, data);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/talent/profile"),
    onSuccess: () => qc.invalidateQueries({ queryKey: talentKeys.profile }),
  });

  function toggle(on: boolean) {
    const next = { ...draft, enabled: on };
    setDraft(next);
    if (on && !complete) return scope.open("talent-profile");
    // Turning off is saved at once; turning on too, once the profile is complete.
    if (exists || on) save.mutate(next);
  }

  const resumeName = resumes.find((r) => r.value === draft.resumeId)?.label ?? "";

  return (
    <Section
      id="talent"
      title="Let recruiters find me"
      description="Recruitment agencies on CV Builder can find you by job title, skills and place, and write to you through us. We never show them your email address."
      actions={
        <Switch
          aria-label="Let recruiters find me"
          checked={draft.enabled}
          disabled={save.isPending || resumes.length === 0}
          onChange={toggle}
        />
      }
      footer={
        (dirty || exists) && (
          <>
            {exists && (
              <Button
                variant="ghost"
                icon="trash"
                className="me-auto text-danger"
                loading={remove.isPending}
                onClick={() => window.confirm("Remove your recruiter profile and the messages you received through it?") && remove.mutate()}
              >
                Remove my profile
              </Button>
            )}
            {dirty && (
              <Button variant="primary" loading={save.isPending} disabled={!complete} onClick={() => save.mutate(draft)}>
                {draft.enabled && !saved.enabled ? "Save and turn on" : "Save changes"}
              </Button>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {resumes.length === 0 ? (
          <Alert>Make a CV first. Then you can choose to show it to recruiters.</Alert>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            {saved.enabled ? (
              <Badge tone="success" icon="check-circle">
                Recruiters can find you
              </Badge>
            ) : (
              <Badge icon="eye-off">Hidden from recruiters</Badge>
            )}
            <span>Turn it off any time; you disappear from search straight away.</span>
          </p>
        )}

        {resumes.length > 0 && (
          <EditableCard
            id="talent-profile"
            title="What recruiters see"
            icon="eye"
            invalid={draft.enabled && !complete}
            view={
              <div className="flex flex-col gap-3">
                <ViewRows
                  showEmpty
                  rows={[
                    { label: "CV", value: resumeName, icon: "file" },
                    { label: "Headline", value: draft.headline, icon: "briefcase" },
                    { label: "Location", value: draft.location, icon: "map-pin" },
                    { label: "Shown", value: SHARE_LABEL[draft.share], icon: "eye" },
                  ]}
                />
                {draft.roles.trim() && (
                  <div className="flex flex-col gap-1">
                    <span className="cvb-caption">Open to</span>
                    <TagView text={draft.roles} />
                  </div>
                )}
              </div>
            }
          >
            <div className="flex flex-col gap-4">
              <Select label="CV to show" value={draft.resumeId} onChange={(e) => set("resumeId", e.target.value)} options={resumes} />
              <TextField
                label="Headline"
                hint="One line about you, e.g. “Frontend developer, 4 years with React”."
                required
                maxLength={120}
                value={draft.headline}
                onChange={(e) => set("headline", e.target.value)}
              />
              <TextField
                label="Location"
                hint="A city or “Remote”. Shown instead of your address."
                optional
                maxLength={120}
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
              />
              <TextField
                label="Roles you're open to"
                hint={`Separate with commas, up to ${TALENT_LIMITS.roles}.`}
                optional
                value={draft.roles}
                onChange={(e) => set("roles", e.target.value)}
              />
              <RadioGroup<TalentShare>
                legend="How much of your CV recruiters can read"
                name="talent-share"
                value={draft.share}
                onChange={(v) => set("share", v)}
                options={[
                  {
                    value: "summary",
                    label: SHARE_LABEL.summary,
                    description: "Your first name, headline, summary, job titles and dates, skills and education. No contact details, links, photo or personal details.",
                  },
                  {
                    value: "full",
                    label: SHARE_LABEL.full,
                    description: "The CV as you wrote it, including any email, phone and links on it. ID card numbers are always left out.",
                  },
                ]}
              />
            </div>
          </EditableCard>
        )}

        {draft.enabled && !complete && <Alert tone="warning">Choose a CV and add a headline, then save to turn this on.</Alert>}
        {(save.error || remove.error) && <Alert tone="danger">{(save.error ?? remove.error)?.message}</Alert>}

        {profile.contacts.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="cvb-overline">Recruiters who wrote to you</span>
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {profile.contacts.map((c, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="text-ink">
                    {c.senderName} · {c.orgName}
                  </span>
                  <span className="cvb-caption">{new Date(c.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
            <p className="cvb-caption">Their messages went to your email. Replying shares your address with them.</p>
          </div>
        )}
      </div>
    </Section>
  );
}
