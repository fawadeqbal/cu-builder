"use client";

import type { CommentDto, ExpertDto, MyExpertProfileDto, OrderDto, OrderMessageDto, ServiceInfoDto } from "@cvb/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const serviceKeys = {
  catalog: ["services", "catalog"] as const,
  included: ["services", "included"] as const,
  experts: (service: string, language: string) => ["experts", service, language] as const,
  expert: (id: string) => ["experts", id] as const,
  slots: (id: string, duration: number) => ["experts", id, "slots", duration] as const,
  me: ["expert", "me"] as const,
  assigned: ["expert", "orders"] as const,
  orders: ["orders"] as const,
  order: (id: string) => ["orders", id] as const,
  messages: (id: string) => ["orders", id, "messages"] as const,
  comments: (resumeId: string) => ["comments", resumeId] as const,
  adminExperts: ["admin", "experts"] as const,
  adminOrders: (status: string) => ["admin", "orders", status] as const,
};

export const useCatalog = () => useQuery({ queryKey: serviceKeys.catalog, queryFn: () => api.get<ServiceInfoDto[]>("/services/catalog"), staleTime: Infinity });
export const useExperts = (service: string, language: string) =>
  useQuery({ queryKey: serviceKeys.experts(service, language), queryFn: () => api.get<ExpertDto[]>(`/experts?${new URLSearchParams({ service, language })}`) });
export const useExpert = (id: string) => useQuery({ queryKey: serviceKeys.expert(id), queryFn: () => api.get<ExpertDto>(`/experts/${id}`), retry: false });
export const useMyExpertProfile = () =>
  useQuery({ queryKey: serviceKeys.me, queryFn: async () => (await api.get<{ profile: MyExpertProfileDto | null }>("/expert/me")).profile });
export const useOrders = () => useQuery({ queryKey: serviceKeys.orders, queryFn: () => api.get<OrderDto[]>("/orders") });
export const useOrder = (id: string) => useQuery({ queryKey: serviceKeys.order(id), queryFn: () => api.get<OrderDto>(`/orders/${id}`), retry: false });
export const useOrderMessages = (id: string, enabled: boolean) =>
  useQuery({ queryKey: serviceKeys.messages(id), queryFn: () => api.get<OrderMessageDto[]>(`/orders/${id}/messages`), enabled, refetchInterval: 30_000 });
export const useComments = (resumeId: string, enabled = true) =>
  useQuery({ queryKey: serviceKeys.comments(resumeId), queryFn: () => api.get<CommentDto[]>(`/resumes/${resumeId}/comments`), enabled, refetchInterval: 60_000 });

export const money = (cents: number, currency = "usd") => new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export const STATUS_LABEL: Record<OrderDto["status"], string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid, waiting for the expert",
  in_progress: "In progress",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  disputed: "In dispute",
};

export const STATUS_TONE: Record<OrderDto["status"], string> = {
  pending_payment: "bg-stone-100 text-stone-700 ring-stone-200",
  paid: "bg-sky-50 text-sky-800 ring-sky-200",
  in_progress: "bg-violet-50 text-violet-800 ring-violet-200",
  delivered: "bg-amber-50 text-amber-900 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-stone-100 text-stone-500 ring-stone-200",
  refunded: "bg-stone-100 text-stone-600 ring-stone-200",
  disputed: "bg-red-50 text-red-700 ring-red-200",
};

export const SERVICE_LABEL: Record<string, string> = { review: "CV review", writing: "CV writing", coaching: "Coaching", linkedin: "LinkedIn makeover" };

export const turnaround = (h: number | null) => (h === null ? "At the booked time" : h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`);

export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
