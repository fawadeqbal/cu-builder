"use client";

import type { ReactNode } from "react";
import { Dialog as DsDialog } from "@cvb/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

/** The design-system dialog (Escape and the backdrop close it, focus stays inside and comes back). */
export function Dialog(props: Props) {
  return <DsDialog {...props} />;
}
