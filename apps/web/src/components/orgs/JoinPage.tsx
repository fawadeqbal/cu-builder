"use client";

import type { JoinPreviewDto, OrgDto } from "@cvb/contracts";
import { ROLE_LABEL } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ORG_KIND_LABEL, orgKeys } from "@/lib/orgs";
import { keys, useMe } from "@/lib/queries";
import { AuthShell } from "../auth/AuthShell";
import { FullPageMessage } from "../ui/FullPageMessage";
import { btn } from "../ui/styles";

/** The branded join link (/join/<code>) and email invitations (/join/<token>). */
export function JoinPage({ code }: { code: string }) {
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const preview = useQuery({
    queryKey: ["join", code, Boolean(me.data)],
    queryFn: () => api.get<JoinPreviewDto>(`/public/join/${encodeURIComponent(code)}`),
    retry: false,
    enabled: !me.isLoading,
  });
  const join = useMutation({
    mutationFn: () => api.post<OrgDto>(`/join/${encodeURIComponent(code)}`),
    onSuccess: (org) => {
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
      void qc.invalidateQueries({ queryKey: keys.me });
      router.replace(org.role && org.role !== "member" ? `/org/${org.id}` : "/app");
    },
  });

  if (me.isLoading || preview.isLoading) return <FullPageMessage>Opening the invitation…</FullPageMessage>;
  const p = preview.data;
  if (!p)
    return (
      <FullPageMessage>
        <div className="flex max-w-sm flex-col items-center gap-3">
          <p className="text-base font-semibold text-stone-800">This invitation isn&apos;t valid</p>
          <p>{preview.error?.message ?? "It may have expired or been cancelled."}</p>
          <Link href="/" className="font-semibold text-brand hover:underline">
            Go to CV Builder
          </Link>
        </div>
      </FullPageMessage>
    );

  const next = encodeURIComponent(`/join/${code}`);
  const needsSeat = p.role === "member" || p.role === "recruiter";
  const full = needsSeat && p.seatsLeft <= 0 && !p.alreadyMember;
  return (
    <AuthShell
      title={`Join ${p.orgName}`}
      subtitle={
        <>
          {ORG_KIND_LABEL[p.kind]} · as {ROLE_LABEL[p.role].toLowerCase()}
          {p.invitedEmail && (
            <>
              {" "}
              · invitation for <strong>{p.invitedEmail}</strong>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {p.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- organisation logo
          <img src={p.logoUrl} alt={`${p.orgName} logo`} className="mx-auto h-12 max-w-40 object-contain" />
        )}
        {p.kind !== "agency" && p.role === "member" && (
          <p className="text-sm text-stone-600">Your CVs stay yours. The career office can see your progress (CVs, ATS score, applications) and comment on your CV to help you.</p>
        )}
        {full ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{p.orgName} has no free seats right now. Ask them to add more, then open this link again.</p>
        ) : me.data ? (
          p.alreadyMember ? (
            <Link href="/org" className={`${btn.primary} w-full`}>
              You&apos;re a member. Open
            </Link>
          ) : (
            <button type="button" className={`${btn.primary} w-full`} disabled={join.isPending} onClick={() => join.mutate()}>
              {join.isPending ? "Joining…" : `Join as ${me.data.email}`}
            </button>
          )
        ) : (
          <>
            <Link href={`/sign-up?next=${next}${p.invitedEmail ? `&email=${encodeURIComponent(p.invitedEmail)}` : ""}`} className={`${btn.primary} w-full`}>
              Create an account to join
            </Link>
            <Link href={`/sign-in?next=${next}`} className={`${btn.secondary} w-full`}>
              I already have an account
            </Link>
          </>
        )}
        {join.error && <p className="text-sm text-red-600">{join.error.message}</p>}
      </div>
    </AuthShell>
  );
}
