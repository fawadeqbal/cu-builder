"use client";

import type { BulkInviteResultDto, MemberDto, OrgDto, OrgRoleDto } from "@cvb/contracts";
import { ROLES_FOR_KIND, ROLE_LABEL } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Alert, Button, Checkbox, FileDrop, Icon, IconButton, Select, TextArea, TextField } from "@cvb/ui";
import { api } from "@/lib/api";
import { orgKeys, useInvites, useMembers } from "@/lib/orgs";
import { Dialog } from "../ui/Dialog";

/** People in the organisation, invitations (one by one or from a CSV) and the join link. */
export function MembersTab({ org, canManage, canInvite }: { org: OrgDto; canManage: boolean; canInvite: boolean }) {
  const members = useMembers(org.id);
  const invites = useInvites(org.id, canInvite);
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: orgKeys.members(org.id) });
    void qc.invalidateQueries({ queryKey: orgKeys.invites(org.id) });
    void qc.invalidateQueries({ queryKey: orgKeys.org(org.id) });
  };
  const roles = ROLES_FOR_KIND[org.kind];
  const pending = (invites.data ?? []).filter((i) => !i.acceptedAt);

  return (
    <div className="flex flex-col gap-6">
      {canInvite && <InviteBox org={org} roles={roles} onDone={refresh} />}

      <section className="flex flex-col gap-3" aria-labelledby="members-title">
        <h2 id="members-title" className="cvb-h2 text-ink">
          {org.kind === "agency" ? "Team" : "Members"}{" "}
          <span className="cvb-num text-ink-3">({members.data?.length ?? 0})</span>
        </h2>
        <div className="cvb-table-wrap relative">
          <table className="cvb-table min-w-[40rem]">
            <thead>
              <tr>
                {["Person", "Role", org.kind === "agency" ? "" : "Cohort", "Seat", ""].map((h, i) => (
                  <th key={i} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.data?.map((m) => (
                <MemberRow key={m.id} org={org} member={m} roles={roles} canManage={canManage} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canInvite && pending.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="pending-title">
          <h2 id="pending-title" className="cvb-h2 text-ink">
            Pending invitations <span className="cvb-num text-ink-3">({pending.length})</span>
          </h2>
          <ul className="cvb-card divide-y divide-line">
            {pending.map((i) => (
              <PendingInvite key={i.id} orgId={org.id} invite={i} onChanged={refresh} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PendingInvite({
  orgId,
  invite,
  onChanged,
}: {
  orgId: string;
  invite: { id: string; email: string; role: OrgRoleDto; cohort: string; expiresAt: string };
  onChanged: () => void;
}) {
  const revoke = useMutation({
    mutationFn: () => api.delete(`/orgs/${orgId}/invites/${invite.id}`),
    onSuccess: onChanged,
  });
  const [now] = useState(() => Date.now());
  const expired = new Date(invite.expiresAt).getTime() < now;
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 truncate font-medium text-ink sm:flex-1">{invite.email}</span>
        <span className="cvb-caption flex items-center gap-1">
          {expired && <Icon name="clock" size={14} />}
          {ROLE_LABEL[invite.role]}
          {invite.cohort && ` · ${invite.cohort}`} ·{" "}
          {expired ? "expired" : `until ${new Date(invite.expiresAt).toLocaleDateString()}`}
        </span>
      </span>
      <IconButton
        tooltip={false}
        icon="trash"
        size="sm"
        label={`Cancel invitation for ${invite.email}`}
        onClick={() => revoke.mutate()}
      />
    </li>
  );
}

function MemberRow({
  org,
  member,
  roles,
  canManage,
  onChanged,
}: {
  org: OrgDto;
  member: MemberDto;
  roles: OrgRoleDto[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [cohort, setCohort] = useState(member.cohort);
  const [error, setError] = useState("");
  const update = useMutation({
    mutationFn: (patch: Partial<Pick<MemberDto, "role" | "cohort" | "seat">>) =>
      api.patch(`/orgs/${org.id}/members/${member.id}`, patch),
    onSuccess: () => (setError(""), onChanged()),
    onError: (e) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/orgs/${org.id}/members/${member.id}`),
    onSuccess: onChanged,
    onError: (e) => setError(e.message),
  });
  const options = roles.includes(member.role) ? roles : [member.role, ...roles];
  return (
    <tr>
      <td className="cvb-table-primary">
        <div className="text-ink">{member.name || member.email}</div>
        <div className="cvb-caption font-normal">{member.email}</div>
        {error && (
          <div className="flex items-center gap-1 text-xs font-normal text-danger" role="alert">
            <Icon name="alert-triangle" size={14} /> {error}
          </div>
        )}
      </td>
      <td>
        {canManage ? (
          <Select
            size="sm"
            aria-label={`Role of ${member.email}`}
            className="w-36"
            value={member.role}
            onChange={(e) => update.mutate({ role: e.target.value as OrgRoleDto })}
          >
            {options.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        ) : (
          ROLE_LABEL[member.role]
        )}
      </td>
      <td>
        {org.kind !== "agency" &&
          (canManage ? (
            <TextField
              size="sm"
              aria-label={`Cohort of ${member.email}`}
              className="w-32"
              value={cohort}
              maxLength={80}
              onChange={(e) => setCohort(e.target.value)}
              onBlur={() => cohort !== member.cohort && update.mutate({ cohort })}
            />
          ) : (
            member.cohort
          ))}
      </td>
      <td>
        <Checkbox
          label={<span className="cvb-sr">Seat</span>}
          aria-label={`${member.email} holds a seat`}
          checked={member.seat}
          disabled={!canManage}
          onChange={(e) => update.mutate({ seat: e.target.checked })}
        />
      </td>
      <td className="text-end">
        {canManage && (
          <IconButton
            tooltip={false}
            icon="trash"
            size="sm"
            label={`Remove ${member.email}`}
            onClick={() => window.confirm(`Remove ${member.email} from ${org.name}?`) && remove.mutate()}
          />
        )}
      </td>
    </tr>
  );
}

function InviteBox({ org, roles, onDone }: { org: OrgDto; roles: OrgRoleDto[]; onDone: () => void }) {
  const inviteRoles = roles.filter((r) => r !== "owner");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRoleDto>(
    inviteRoles[inviteRoles.length - 1] === "member" ? "member" : inviteRoles[0]!,
  );
  const [cohort, setCohort] = useState("");
  const [copied, setCopied] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [sent, setSent] = useState("");
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/join/${org.inviteCode}`;
  const invite = useMutation({
    mutationFn: () => api.post(`/orgs/${org.id}/invites`, { email: email.trim(), role, cohort: cohort.trim() }),
    onSuccess: () => {
      setSent(`Invitation sent to ${email.trim()}.`);
      setEmail("");
      onDone();
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setSent("");
    invite.mutate();
  }
  return (
    <section className="cvb-card" aria-labelledby="invite-title">
      <div className="cvb-card-head">
        <div className="cvb-card-head-text">
          <h2 id="invite-title" className="cvb-h3">
            Invite people
          </h2>
        </div>
      </div>
      <div className="cvb-card-body gap-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <TextField
            type="email"
            label="Email"
            required
            className="min-w-56 flex-[2]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@university.edu"
          />
          <Select
            label="Role"
            className="w-full sm:w-36"
            value={role}
            onChange={(e) => setRole(e.target.value as OrgRoleDto)}
          >
            {inviteRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
          {org.kind !== "agency" && (
            <TextField
              label="Cohort"
              className="w-full sm:w-36"
              value={cohort}
              maxLength={80}
              onChange={(e) => setCohort(e.target.value)}
              placeholder="e.g. BSCS 2026"
            />
          )}
          <Button type="submit" variant="primary" loading={invite.isPending}>
            {invite.isPending ? "Sending…" : "Send invitation"}
          </Button>
          <Button icon="upload" onClick={() => setBulk(true)}>
            Invite from CSV
          </Button>
        </form>
        {invite.error && <Alert tone="danger">{invite.error.message}</Alert>}
        {sent && <Alert tone="success">{sent}</Alert>}
        {org.inviteCode && (
          <div className="flex flex-col gap-1.5 border-t border-line pt-4">
            <span className="cvb-label" id="join-link-label">
              Join link {org.kind === "agency" ? "for recruiters" : "for students"}
            </span>
            <div className="flex gap-2">
              <TextField
                readOnly
                aria-label="Join link"
                dir="ltr"
                value={link}
                className="min-w-0 flex-1"
                inputClassName="font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button
                icon={copied ? "check" : "copy"}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(link)
                    .then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))
                }
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="cvb-caption">
              Anyone with the link can join while seats last ({Math.max(0, org.seats - org.seatsUsed)} left). People on
              your email domains join automatically when they sign in with Google or Microsoft.
            </p>
          </div>
        )}
        {bulk && <BulkInvite org={org} onClose={() => setBulk(false)} onDone={onDone} />}
      </div>
    </section>
  );
}

function BulkInvite({ org, onClose, onDone }: { org: OrgDto; onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<BulkInviteResultDto | null>(null);
  const [done, setDone] = useState<BulkInviteResultDto | null>(null);
  const run = useMutation({
    mutationFn: (dryRun: boolean) => api.post<BulkInviteResultDto>(`/orgs/${org.id}/invites/bulk`, { csv, dryRun }),
    onSuccess: (r, dryRun) => {
      if (dryRun) setPreview(r);
      else {
        setDone(r);
        onDone();
      }
    },
  });
  async function readFile(file: File | undefined) {
    if (!file) return;
    setCsv(await file.text());
    setPreview(null);
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="Invite from a CSV"
      description="One person per line: email, role (student, reviewer, admin or recruiter) and cohort. A header row is optional."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {done ? "Close" : "Cancel"}
          </Button>
          {!done &&
            (preview ? (
              <Button
                variant="primary"
                loading={run.isPending}
                disabled={preview.rows.length === 0}
                onClick={() => run.mutate(false)}
              >
                {run.isPending ? "Sending…" : `Send ${preview.rows.length} invitations`}
              </Button>
            ) : (
              <Button variant="primary" loading={run.isPending} disabled={!csv.trim()} onClick={() => run.mutate(true)}>
                Check the list
              </Button>
            ))}
        </>
      }
    >
      {done ? (
        <Alert tone="success">
          Sent {done.invited} invitations{done.skipped.length ? `; ${done.skipped.length} were already members` : ""}.
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <FileDrop
            title="Drop a CSV file here"
            hint="Or paste the list below."
            accept=".csv,text/csv,text/plain"
            button="Choose CSV file"
            onFiles={(files) => void readFile(files[0])}
          />
          <TextArea
            aria-label="CSV text"
            dir="ltr"
            rows={8}
            className="[&_textarea]:font-mono [&_textarea]:text-xs"
            value={csv}
            onChange={(e) => (setCsv(e.target.value), setPreview(null))}
            placeholder={"email,role,cohort\nali@uni.edu.pk,student,BSCS 2026\nsara@uni.edu.pk,reviewer,"}
          />
          {run.error && <Alert tone="danger">{run.error.message}</Alert>}
          {preview && (
            <div className="flex flex-col gap-2 text-sm" data-testid="csv-preview">
              <p className="font-medium text-ink">
                {preview.rows.length} to invite · {preview.skipped.length} already members · {preview.errors.length}{" "}
                problems
              </p>
              {preview.errors.length > 0 && (
                <Alert tone="danger">
                  <ul className="max-h-40 overflow-y-auto">
                    {preview.errors.map((e) => (
                      <li key={e.line}>
                        Line {e.line}: {e.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
              {preview.skipped.length > 0 && (
                <ul className="cvb-caption max-h-24 overflow-y-auto">
                  {preview.skipped.map((s) => (
                    <li key={s.line}>
                      Line {s.line}: {s.email} ({s.reason.toLowerCase()})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
