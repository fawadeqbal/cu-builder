"use client";

import type { OrgDto } from "@cvb/contracts";
import { ROLE_LABEL } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  RadioGroup,
  Skeleton,
  TextField,
} from "@cvb/ui";
import { api } from "@/lib/api";
import { ORG_KIND_LABEL, orgKeys, useMyOrgs } from "@/lib/orgs";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";

function Shell({ narrow, children }: { narrow?: boolean; children: ReactNode }) {
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <main
            className={`mx-auto flex w-full flex-col gap-6 px-4 pb-20 pt-10 sm:px-6 ${narrow ? "max-w-(--layout-sm)" : "max-w-(--layout-lg)"}`}
          >
            {children}
          </main>
        </div>
      )}
    </RequireAuth>
  );
}

/** Organisations you belong to: universities, career centres, agencies. */
export function OrgsPage() {
  return (
    <Shell>
      <OrgList />
    </Shell>
  );
}

function OrgList() {
  const orgs = useMyOrgs();
  return (
    <>
      <PageHeader
        title="Organisations"
        description="Career centres follow their students' progress; agencies format candidate CVs in their own template."
        actions={
          <Button variant="primary" icon="plus" href="/org/new">
            New organisation
          </Button>
        }
      />
      {orgs.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} height={84} shape="block" />
          ))}
        </div>
      ) : !orgs.data?.length ? (
        <Card>
          <EmptyState icon="building" title="You're not part of an organisation yet">
            <p>If your university or employer sent you a link, open it to join.</p>
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orgs.data.map((o) => (
            <li key={o.id}>
              <OrgCard org={o} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function OrgCard({ org }: { org: OrgDto }) {
  const staff = org.role && org.role !== "member";
  const body = (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={org.name} src={org.branding.logoUrl || null} shape="square" className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="cvb-h3 truncate text-ink">{org.name}</span>
          <span className="cvb-caption">
            {ORG_KIND_LABEL[org.kind]} · {org.role ? ROLE_LABEL[org.role] : "Site admin"}
          </span>
        </div>
        {staff && <Icon name="chevron-right" size={18} className="shrink-0 text-ink-3" />}
      </div>
      {org.role === "member" && org.seatsUsed > 0 && (
        <Badge tone="success" icon="check">
          Your {org.seatPlan} access comes from this organisation.
        </Badge>
      )}
    </>
  );
  return staff ? (
    <Link href={`/org/${org.id}`} className="cvb-card cvb-card-interactive flex h-full flex-col gap-3 p-5">
      {body}
    </Link>
  ) : (
    <div className="cvb-card flex h-full flex-col gap-3 p-5">{body}</div>
  );
}

export function NewOrgPage() {
  return (
    <Shell narrow>
      <NewOrgForm />
    </Shell>
  );
}

function NewOrgForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OrgDto["kind"]>("university");
  const create = useMutation({
    mutationFn: () => api.post<OrgDto>("/orgs", { name: name.trim(), kind }),
    onSuccess: (org) => {
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
      router.push(`/org/${org.id}`);
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  return (
    <>
      <PageHeader back={{ href: "/org", label: "Organisations" }} title="New organisation" />
      <form onSubmit={submit}>
        <Card
          footer={
            <Button type="submit" variant="primary" loading={create.isPending} disabled={name.trim().length < 2}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          }
        >
          <TextField
            id="org-name"
            label="Name"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. FAST Career Services"
          />
          <RadioGroup<"university" | "agency">
            legend="Type"
            name="kind"
            value={kind === "agency" ? "agency" : "university"}
            onChange={(k) => setKind(k)}
            options={(["university", "agency"] as const).map((k) => ({
              value: k,
              label: ORG_KIND_LABEL[k],
              description:
                k === "university"
                  ? "Invite students, see who has a CV, their ATS scores and applications, and comment on their CVs."
                  : "Upload candidate CVs in bulk, check what the reader wasn't sure of, and export them in your template.",
            }))}
          />
          <p className="cvb-caption">
            Seat licences for students are added by our team after you&apos;ve talked to us.
          </p>
          {create.error && <Alert tone="danger">{create.error.message}</Alert>}
        </Card>
      </form>
    </>
  );
}
