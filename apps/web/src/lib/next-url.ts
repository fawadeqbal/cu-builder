/** A same-site path to go to after signing in; anything else falls back to `fallback`. */
export function safeNext(value: string | null | undefined, fallback = "/app"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
