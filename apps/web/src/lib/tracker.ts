"use client";

import type {
  ApplicationDto,
  BoardDto,
  FeedJobDto,
  InterviewSessionDto,
  JobPreferencesDto,
  ReminderDto,
  StarStoryDto,
  UpdateApplicationDto,
} from "@cvb/contracts";
import type { BankQuestion } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const trackerKeys = {
  board: ["tracker", "board"] as const,
  applications: (archived = false) => ["tracker", "applications", archived] as const,
  all: ["tracker"] as const,
  reminders: (from: string, to: string) => ["tracker", "reminders", from, to] as const,
  feed: (q: string, location: string, remote: boolean) => ["feed", q, location, remote] as const,
  prefs: ["feed", "preferences"] as const,
  bank: (family: string, seniority: string) => ["interviews", "bank", family, seniority] as const,
  sessions: ["interviews", "sessions"] as const,
  stories: ["interviews", "stories"] as const,
};

export const useBoard = () => useQuery({ queryKey: trackerKeys.board, queryFn: () => api.get<BoardDto>("/tracker/board") });

export const useApplications = (archived = false) =>
  useQuery({ queryKey: trackerKeys.applications(archived), queryFn: () => api.get<ApplicationDto[]>(`/applications${archived ? "?archived=true" : ""}`) });

export const useReminders = (from: Date, to: Date) =>
  useQuery({
    queryKey: trackerKeys.reminders(from.toISOString(), to.toISOString()),
    queryFn: () => api.get<ReminderDto[]>(`/reminders?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`),
  });

/** Saves application fields; optimistic so typing in the drawer feels instant. */
export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateApplicationDto }) => api.patch<ApplicationDto>(`/applications/${id}`, patch),
    onSuccess: (app) => {
      qc.setQueryData<ApplicationDto[]>(trackerKeys.applications(false), (list) => list?.map((a) => (a.id === app.id ? app : a)));
      void qc.invalidateQueries({ queryKey: ["tracker", "reminders"] });
    },
  });
}

export type FeedResult = { jobs: FeedJobDto[]; keywords: string; sources: string[] };

export const useFeed = (q: string, location: string, remote: boolean, enabled = true) =>
  useQuery({
    queryKey: trackerKeys.feed(q, location, remote),
    queryFn: () => api.get<FeedResult>(`/feed?${new URLSearchParams({ ...(q ? { q } : {}), ...(location ? { location } : {}), remote: String(remote) })}`),
    staleTime: 5 * 60_000,
    enabled,
  });

export const usePreferences = () => useQuery({ queryKey: trackerKeys.prefs, queryFn: () => api.get<JobPreferencesDto>("/feed/preferences") });

export const useQuestionBank = (family: string, seniority: string) =>
  useQuery({
    queryKey: trackerKeys.bank(family, seniority),
    queryFn: () =>
      api.get<{ family: string; families: string[]; competencies: string[]; questions: BankQuestion[] }>(
        `/interviews/bank?${new URLSearchParams({ family, seniority })}`,
      ),
    staleTime: Infinity,
  });

export const useInterviewSessions = () => useQuery({ queryKey: trackerKeys.sessions, queryFn: () => api.get<InterviewSessionDto[]>("/interviews/sessions") });
export const useStories = () => useQuery({ queryKey: trackerKeys.stories, queryFn: () => api.get<StarStoryDto[]>("/interviews/stories") });

/** "2026-10-22T09:00" for <input type="datetime-local">, in local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);
