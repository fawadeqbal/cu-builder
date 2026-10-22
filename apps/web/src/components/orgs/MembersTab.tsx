"use client";

import type { BulkInviteResultDto, MemberDto, OrgDto, OrgRoleDto } from "@cvb/contracts";
import { ROLES_FOR_KIND, ROLE_LABEL } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { CopyIcon, TrashIcon, UploadIcon } from "@cvb/ui";
import { api } from "@/lib/api";
import { orgKeys, useInvites, useMembers } from "@/lib/orgs";
import { Dialog } from "../ui/Dialog";
import { btn, card, field, label } from "../ui/styles";

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

      <section className={`${card} overflow-hidden`}>
        <h2 className="border-b border-stone-100 px-4 py-3 text-base font-semibold text-stone-900">
          {org.kind === "agency" ? "Team" : "Members"} <span className="text-sm font-normal text-stone-500">({members.data?.length ?? 0})</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                {["Person", "Role", org.kind === "agency" ? "" : "Cohort", "Seat", ""].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {members.data?.map((m) => (
                <MemberRow key={m.id} org={org} member={m} roles={roles} canManage={canManage} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canInvite && pending.length > 0 && (
        <section className={`${card} overflow-hidden`}>
          <h2 className="border-b border-stone-100 px-4 py-3 text-base font-semibold text-stone-900">Pending invitations ({pending.length})</h2>
          <ul className="divide-y divide-stone-100">
            {pending.map((i) => (
              <PendingInvite key={i.id} orgId={org.id} invite={i} onChanged={refresh} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PendingInvite({ orgId, invite, onChanged }: { orgId: string; invite: { id: string; email: string; role: OrgRoleDto; cohort: string; expiresAt: string }; onChanged: () => void }) {
  const revoke = useMutation({ mutationFn: () => api.delete(`/orgs/${orgId}/invites/${invite.id}`), onSuccess: onChanged });
  const [now] = useState(() => Date.now());
  const expired = new Date(invite.expiresAt).getTime() < now;
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className="min-w-0 flex-1 truncate text-stone-800">{invite.email}</span>
      <span className="text-xs text-stone-500">
        {ROLE_LABEL[invite.role]}
        {invite.cohort && ` · ${invite.cohort}`} · {expired ? "expired" : `until ${new Date(invite.expiresAt).toLocaleDateString()}`}
      </span>
      <button type="button" className={btn.ghost} aria-label={`Cancel invitation for ${invite.email}`} onClick={() => revoke.mutate()}>
        <TrashIcon className="size-4" />
      </button>
    </li>
  );
}

function MemberRow({ org, member, roles, canManage, onChanged }: { org: OrgDto; member: MemberDto; roles: OrgRoleDto[]; canManage: boolean; onChanged: () => void }) {
  const [cohort, setCohort] = useState(member.cohort);
  const [error, setError] = useState("");
  const update = useMutation({
    mutationFn: (patch: Partial<Pick<MemberDto, "role" | "cohort" | "seat">>) => api.patch(`/orgs/${org.id}/members/${member.id}`, patch),
    onSuccess: () => (setError(""), onChanged()),
    onError: (e) => setError(e.message),
  });
  const remove = useMutation({ mutationFn: () => api.delete(`/orgs/${org.id}/members/${member.id}`), onSuccess: onChanged, onError: (e) => setError(e.message) });
  const options = roles.includes(member.role) ? roles : [member.role, ...roles];
  return (
    <tr>
      <td className="px-4 py-2.5">
        <div className="font-medium text-stone-900">{member.name || member.email}</div>
        <div className="text-xs text-stone-500">{member.email}</div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </td>
      <td className="px-4 py-2.5">
        {canManage ? (
          <select aria-label={`Role of ${member.email}`} className={`${field} w-36 py-1`} value={member.role} onChange={(e) => update.mutate({ role: e.target.value as OrgRoleDto })}>
            {options.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        ) : (
          ROLE_LABEL[member.role]
        )}
      </td>
      <td className="px-4 py-2.5">
        {org.kind !== "agency" &&
          (canManage ? (
            <input aria-label={`Cohort of ${member.email}`} className={`${field} w-32 py-1`} value={cohort} maxLength={80} onChange={(e) => setCohort(e.target.value)} onBlur={() => cohort !== member.cohort && update.mutate({ cohort })} />
          ) : (
            member.cohort
          ))}
      </td>
      <td className="px-4 py-2.5">
        <input
          type="checkbox"
          className="size-4 accent-brand"
          aria-label={`${member.email} holds a seat`}
          checked={member.seat}
          disabled={!canManage}
          onChange={(e) => update.mutate({ seat: e.target.checked })}
        />
      </td>
      <td className="px-4 py-2.5 text-end">
        {canManage && (
          <button type="button" className={btn.ghost} aria-label={`Remove ${member.email}`} onClick={() => window.confirm(`Remove ${member.email} from ${org.name}?`) && remove.mutate()}>
            <TrashIcon className="size-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

function InviteBox({ org, roles, onDone }: { org: OrgDto; roles: OrgRoleDto[]; onDone: () => void }) {
  const inviteRoles = roles.filter((r) => r !== "owner");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRoleDto>(inviteRoles[inviteRoles.length - 1] === "member" ? "member" : inviteRoles[0]!);
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
    <section className={`${card} flex flex-col gap-4 p-5`}>
      <h2 className="text-base font-semibold text-stone-900">Invite people</h2>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-56 flex-[2] text-xs font-medium text-stone-600">
          Email
          <input type="email" required className={`${field} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@university.edu" />
        </label>
        <label className="w-36 text-xs font-medium text-stone-600">
          Role
          <select className={`${field} mt-1`} value={role} onChange={(e) => setRole(e.target.value as OrgRoleDto)}>
            {inviteRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        {org.kind !== "agency" && (
          <label className="w-36 text-xs font-medium text-stone-600">
            Cohort
            <input className={`${field} mt-1`} value={cohort} maxLength={80} onChange={(e) => setCohort(e.target.value)} placeholder="e.g. BSCS 2026" />
          </label>
        )}
        <button type="submit" className={btn.primary} disabled={invite.isPending}>
          {invite.isPending ? "Sending…" : "Send invitation"}
        </button>
        <button type="button" className={btn.secondary} onClick={() => setBulk(true)}>
          <UploadIcon className="size-4" /> Invite from CSV
        </button>
      </form>
      {invite.error && <p className="text-sm text-red-600">{invite.error.message}</p>}
      {sent && <p className="text-sm text-emerald-700">{sent}</p>}
      {org.inviteCode && (
        <div>
          <span className={label}>Join link {org.kind === "agency" ? "for recruiters" : "for students"}</span>
          <div className="flex gap-2">
            <input readOnly aria-label="Join link" value={link} className={`${field} font-mono text-xs`} onFocus={(e) => e.target.select()} />
            <button type="button" className={btn.secondary} onClick={() => void navigator.clipboard.writeText(link).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
              <CopyIcon className="size-4" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Anyone with the link can join while seats last ({Math.max(0, org.seats - org.seatsUsed)} left). People on your email domains join automatically when they sign in with Google or Microsoft.
          </p>
        </div>
      )}
      {bulk && <BulkInvite org={org} onClose={() => setBulk(false)} onDone={onDone} />}
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
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {done ? "Close" : "Cancel"}
          </button>
          {!done &&
            (preview ? (
              <button type="button" className={btn.primary} disabled={run.isPending || preview.rows.length === 0} onClick={() => run.mutate(false)}>
                {run.isPending ? "Sending…" : `Send ${preview.rows.length} invitations`}
              </button>
            ) : (
              <button type="button" className={btn.primary} disabled={run.isPending || !csv.trim()} onClick={() => run.mutate(true)}>
                Check the list
              </button>
            ))}
        </div>
      }
    >
      {done ? (
        <p className="text-sm text-emerald-700">
          Sent {done.invited} invitations{done.skipped.length ? `; ${done.skipped.length} were already members` : ""}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <input type="file" accept=".csv,text/csv,text/plain" aria-label="CSV file" className="text-sm" onChange={(e) => void readFile(e.target.files?.[0])} />
          <textarea
            aria-label="CSV text"
            rows={8}
            className={`${field} font-mono text-xs`}
            value={csv}
            onChange={(e) => (setCsv(e.target.value), setPreview(null))}
            placeholder={"email,role,cohort\nali@uni.edu.pk,student,BSCS 2026\nsara@uni.edu.pk,reviewer,"}
          />
          {run.error && <p className="text-sm text-red-600">{run.error.message}</p>}
          {preview && (
            <div className="flex flex-col gap-2 text-sm" data-testid="csv-preview">
              <p className="font-medium text-stone-900">
                {preview.rows.length} to invite · {preview.skipped.length} already members · {preview.errors.length} problems
              </p>
              {preview.errors.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-lg bg-red-50 p-2 text-xs text-red-800 ring-1 ring-red-200">
                  {preview.errors.map((e) => (
                    <li key={e.line}>
                      Line {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {preview.skipped.length > 0 && (
                <ul className="max-h-24 overflow-y-auto text-xs text-stone-500">
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
