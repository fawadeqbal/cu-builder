/** Shared class strings so buttons and fields look the same on every page. */
export const btn = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-stone-800 shadow-xs ring-1 ring-inset ring-stone-200 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60",
  dark: "inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700 disabled:opacity-60",
};

export const field =
  "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-stone-900 shadow-xs ring-1 ring-inset ring-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand";

export const label = "mb-1 block text-[13px] font-medium text-stone-700";

export const card = "rounded-2xl border border-stone-200 bg-white shadow-xs";
