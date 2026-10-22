"use client";

import type {
  AuthProvidersDto,
  CoverLetterDto,
  JobDto,
  BillingStatusDto,
  MeDto,
  OfferDto,
  Page,
  ResumeDto,
  ResumeImportDto,
  ResumeSummary,
  ResumeVersionDto,
  SessionDto,
  ShareLinkDto,
  TemplateSettingDto,
} from "@cvb/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** Query keys in one place so mutations can invalidate precisely. */
export const keys = {
  me: ["me"] as const,
  providers: ["auth-providers"] as const,
  resumes: ["resumes"] as const,
  trash: ["resumes", "trash"] as const,
  resume: (id: string) => ["resumes", id] as const,
  versions: (id: string) => ["resumes", id, "versions"] as const,
  shareLinks: (id: string) => ["resumes", id, "share-links"] as const,
  imports: ["imports"] as const,
  offers: ["billing", "offers"] as const,
  billing: ["billing", "status"] as const,
  templateSettings: ["templates", "settings"] as const,
  jobs: ["jobs"] as const,
  job: (id: string) => ["jobs", id] as const,
  letters: ["cover-letters"] as const,
  letter: (id: string) => ["cover-letters", id] as const,
};

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async (): Promise<MeDto | null> => (await api.get<SessionDto>("/session")).user,
    staleTime: 60_000,
  });
}

export const useAuthProviders = () =>
  useQuery({ queryKey: keys.providers, queryFn: () => api.get<AuthProvidersDto>("/auth-providers"), staleTime: Infinity });

export const useResumes = (enabled = true) =>
  useQuery({ queryKey: keys.resumes, queryFn: () => api.get<Page<ResumeSummary>>("/resumes?limit=100"), enabled });

export const useTrash = (enabled = true) =>
  useQuery({ queryKey: keys.trash, queryFn: () => api.get<ResumeSummary[]>("/resumes/trash"), enabled });

export const useResume = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.resume(id), queryFn: () => api.get<ResumeDto>(`/resumes/${id}`), staleTime: Infinity, retry: false, enabled });

export const useVersions = (id: string, enabled: boolean) =>
  useQuery({ queryKey: keys.versions(id), queryFn: () => api.get<ResumeVersionDto[]>(`/resumes/${id}/versions`), enabled });

export const useShareLinks = (id: string, enabled: boolean) =>
  useQuery({ queryKey: keys.shareLinks(id), queryFn: () => api.get<ShareLinkDto[]>(`/resumes/${id}/share-links`), enabled });

export const useImports = (enabled = true) =>
  useQuery({
    queryKey: keys.imports,
    queryFn: () => api.get<ResumeImportDto[]>("/imports"),
    enabled,
    // Poll while something is still being processed.
    refetchInterval: (q) => (q.state.data?.some((i) => i.status === "queued" || i.status === "processing") ? 1500 : false),
  });

export const useOffers = () => useQuery({ queryKey: keys.offers, queryFn: () => api.get<OfferDto[]>("/billing/offers"), staleTime: 300_000 });

export const useBillingStatus = (enabled = true) =>
  useQuery({ queryKey: keys.billing, queryFn: () => api.get<BillingStatusDto>("/billing/status"), enabled });

/** Admin overrides for the template catalog; empty when the API is unreachable. */
export const useTemplateSettings = () =>
  useQuery({
    queryKey: keys.templateSettings,
    queryFn: () => api.get<TemplateSettingDto[]>("/templates/settings").catch(() => [] as TemplateSettingDto[]),
    staleTime: 300_000,
  });

export const useJobs = (enabled = true) => useQuery({ queryKey: keys.jobs, queryFn: () => api.get<JobDto[]>("/jobs"), enabled });

export const useLetters = (enabled = true) =>
  useQuery({ queryKey: keys.letters, queryFn: () => api.get<CoverLetterDto[]>("/cover-letters"), enabled });

export const useLetter = (id: string) =>
  useQuery({ queryKey: keys.letter(id), queryFn: () => api.get<CoverLetterDto>(`/cover-letters/${id}`), staleTime: Infinity, retry: false });
