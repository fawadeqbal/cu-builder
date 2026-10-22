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
  pending_payment: "bg-surface-2 text-ink-2 ring-line",
  paid: "bg-info-soft text-info ring-info/40",
  in_progress: "bg-brand-soft text-brand-ink ring-brand/40",
  delivered: "bg-warning-soft text-warning ring-warning/40",
  completed: "bg-success-soft text-success ring-success/40",
  cancelled: "bg-surface-2 text-ink-3 ring-line",
  refunded: "bg-surface-2 text-ink-2 ring-line",
  disputed: "bg-danger-soft text-danger ring-danger/40",
};

export const SERVICE_LABEL: Record<string, string> = { review: "CV review", writing: "CV writing", coaching: "Coaching", linkedin: "LinkedIn makeover" };

export const turnaround = (h: number | null) => (h === null ? "At the booked time" : h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`);

export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
