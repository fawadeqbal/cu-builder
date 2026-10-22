"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@cvb/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
};

const WIDTH = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

/** Modal dialog: traps nothing fancy, but closes on Escape and backdrop click, and restores focus. */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("input, button:not([data-close]), select, textarea")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[60] grid place-items-end bg-stone-950/40 backdrop-blur-[2px] sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92dvh] w-full ${WIDTH[size]} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-stone-900/10 sm:rounded-2xl`}
      >
        <div className="flex items-start gap-3 border-b border-stone-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-stone-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
