"use client";

import type { TalentContactLogDto, TalentDetailDto, TalentProfileDto, TalentSearchResultDto } from "@cvb/contracts";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type TalentFilters = { q: string; location: string; role: string };

export const talentKeys = {
  profile: ["talent", "profile"] as const,
  search: (orgId: string, f: TalentFilters) => ["orgs", orgId, "talent", "search", f] as const,
  detail: (orgId: string, id: string) => ["orgs", orgId, "talent", "detail", id] as const,
  contacts: (orgId: string) => ["orgs", orgId, "talent", "contacts"] as const,
};

/** The signed-in person's own "Let recruiters find me" profile. */
export const useTalentProfile = () => useQuery({ queryKey: talentKeys.profile, queryFn: () => api.get<TalentProfileDto>("/talent/profile") });

const searchUrl = (orgId: string, f: TalentFilters, cursor: number) => {
  const p = new URLSearchParams({ limit: "20" });
  if (f.q) p.set("q", f.q);
  if (f.location) p.set("location", f.location);
  if (f.role) p.set("role", f.role);
  if (cursor) p.set("cursor", String(cursor));
  return `/orgs/${orgId}/talent?${p}`;
};

export const useTalentSearch = (orgId: string, f: TalentFilters) =>
  useInfiniteQuery({
    queryKey: talentKeys.search(orgId, f),
    queryFn: ({ pageParam }) => api.get<TalentSearchResultDto>(searchUrl(orgId, f, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

export const useTalentDetail = (orgId: string, id: string | null) =>
  useQuery({
    queryKey: talentKeys.detail(orgId, id ?? ""),
    queryFn: () => api.get<TalentDetailDto>(`/orgs/${orgId}/talent/${id}`),
    enabled: Boolean(id),
    retry: false,
  });

export const useTalentContacts = (orgId: string) =>
  useQuery({ queryKey: talentKeys.contacts(orgId), queryFn: () => api.get<TalentContactLogDto[]>(`/orgs/${orgId}/talent/contacts`) });
