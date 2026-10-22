"use client";

import type { CandidateDto, CohortDto, InviteDto, MemberDto, OrgDto } from "@cvb/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const orgKeys = {
  mine: ["orgs"] as const,
  org: (id: string) => ["orgs", id] as const,
  members: (id: string) => ["orgs", id, "members"] as const,
  invites: (id: string) => ["orgs", id, "invites"] as const,
  cohort: (id: string, cohort: string) => ["orgs", id, "cohort", cohort] as const,
  candidates: (id: string) => ["orgs", id, "candidates"] as const,
};

export const useMyOrgs = () => useQuery({ queryKey: orgKeys.mine, queryFn: () => api.get<OrgDto[]>("/orgs") });
export const useOrg = (id: string) => useQuery({ queryKey: orgKeys.org(id), queryFn: () => api.get<OrgDto>(`/orgs/${id}`), retry: false });
export const useMembers = (id: string, enabled = true) => useQuery({ queryKey: orgKeys.members(id), queryFn: () => api.get<MemberDto[]>(`/orgs/${id}/members`), enabled });
export const useInvites = (id: string, enabled = true) => useQuery({ queryKey: orgKeys.invites(id), queryFn: () => api.get<InviteDto[]>(`/orgs/${id}/invites`), enabled });
export const useCohort = (id: string, cohort: string) =>
  useQuery({ queryKey: orgKeys.cohort(id, cohort), queryFn: () => api.get<CohortDto>(`/orgs/${id}/cohort${cohort ? `?cohort=${encodeURIComponent(cohort)}` : ""}`) });

/** Polls while the worker is still reading files. */
export const useCandidates = (id: string, enabled = true) =>
  useQuery({
    queryKey: orgKeys.candidates(id),
    queryFn: () => api.get<CandidateDto[]>(`/orgs/${id}/candidates`),
    enabled,
    refetchInterval: (q) => (q.state.data?.some((c) => c.status === "queued" || c.status === "parsing") ? 2000 : false),
  });

/** Mirrors orgCan in @cvb/domain for showing and hiding controls (the API decides). */
export const ORG_KIND_LABEL = { university: "University or career centre", agency: "Recruitment agency", partner: "Partner" } as const;
