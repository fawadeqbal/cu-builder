"use client";

import type { JoinPreviewDto, OrgDto } from "@cvb/contracts";
import { ROLE_LABEL } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ORG_KIND_LABEL, orgKeys } from "@/lib/orgs";
import { keys, useMe } from "@/lib/queries";
import { AuthShell } from "../auth/AuthShell";
import { FullPageMessage } from "../ui/FullPageMessage";
import { Alert, Avatar, Button, EmptyState, Spinner } from "@cvb/ui";

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

  if (me.isLoading || preview.isLoading)
    return (
      <FullPageMessage>
        <span className="flex items-center gap-2">
          <Spinner /> Opening the invitation…
        </span>
      </FullPageMessage>
    );
  const p = preview.data;
  if (!p)
    return (
      <FullPageMessage>
        <div className="cvb-card max-w-sm">
          <EmptyState
            icon="mail"
            title="This invitation isn't valid"
            actions={
              <Button variant="primary" href="/">
                Go to CV Builder
              </Button>
            }
          >
            <p>{preview.error?.message ?? "It may have expired or been cancelled."}</p>
          </EmptyState>
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
      <div className="flex flex-col gap-4">
        {p.logoUrl && (
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-3">
            <Avatar name={`${p.orgName} logo`} src={p.logoUrl} shape="square" size="lg" />
            <span className="cvb-h3 min-w-0 text-ink">{p.orgName}</span>
          </div>
        )}
        {p.kind !== "agency" && p.role === "member" && (
          <p className="text-ink-2">
            Your CVs stay yours. The career office can see your progress (CVs, ATS score, applications) and comment on
            your CV to help you.
          </p>
        )}
        {full ? (
          <Alert tone="warning">
            {p.orgName} has no free seats right now. Ask them to add more, then open this link again.
          </Alert>
        ) : me.data ? (
          p.alreadyMember ? (
            <Button variant="primary" block href="/org">
              You&apos;re a member. Open
            </Button>
          ) : (
            <Button variant="primary" block loading={join.isPending} onClick={() => join.mutate()}>
              {join.isPending ? "Joining…" : `Join as ${me.data.email}`}
            </Button>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              block
              href={`/sign-up?next=${next}${p.invitedEmail ? `&email=${encodeURIComponent(p.invitedEmail)}` : ""}`}
            >
              Create an account to join
            </Button>
            <Button block href={`/sign-in?next=${next}`}>
              I already have an account
            </Button>
          </div>
        )}
        {join.error && <Alert tone="danger">{join.error.message}</Alert>}
      </div>
    </AuthShell>
  );
}
