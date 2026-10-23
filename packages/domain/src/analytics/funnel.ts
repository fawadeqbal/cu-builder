/**
 * Funnel maths over pre-aggregated groups. Each group is "people who did exactly these steps"
 * with a count, so a database can do the counting and this stays exact and testable.
 *
 * A person counts at step k when they did step k and every step before it within the period
 * (a closed funnel). Order inside the period is not enforced: people often sign up before they
 * download, and the question is "how many got this far", not "in this exact order".
 */

export type FunnelGroup = { steps: readonly boolean[]; count: number };

export type FunnelStepResult = {
  key: string;
  count: number;
  /** Share of people who entered the funnel (step 1). */
  ofFirst: number;
  /** Share of people at the step before. */
  ofPrevious: number;
  /** People lost since the step before, as a share of it. */
  dropOff: number;
};

export function funnel(keys: readonly string[], groups: readonly FunnelGroup[]): FunnelStepResult[] {
  const counts = keys.map((_, k) => groups.reduce((n, g) => (g.steps.slice(0, k + 1).every(Boolean) && g.steps.length > k ? n + g.count : n), 0));
  const first = counts[0] ?? 0;
  return keys.map((key, k) => {
    const count = counts[k] ?? 0;
    const prev = k === 0 ? count : (counts[k - 1] ?? 0);
    return {
      key,
      count,
      ofFirst: first > 0 ? count / first : 0,
      ofPrevious: prev > 0 ? count / prev : 0,
      dropOff: k === 0 || prev === 0 ? 0 : (prev - count) / prev,
    };
  });
}

/**
 * A funnel per value of one dimension (source, device…), largest entry step first. Values past
 * `limit` fold into "Other" so the breakdown stays readable.
 */
export function funnelBreakdown(
  keys: readonly string[],
  groups: readonly (FunnelGroup & { dim: string | null })[],
  limit = 6,
  other = "Other",
): { value: string; steps: FunnelStepResult[] }[] {
  const byDim = new Map<string, FunnelGroup[]>();
  for (const g of groups) {
    const dim = g.dim ?? "(unknown)";
    byDim.set(dim, [...(byDim.get(dim) ?? []), g]);
  }
  const rows = [...byDim.entries()]
    .map(([value, gs]) => ({ value, groups: gs, entered: funnel(keys, gs)[0]?.count ?? 0 }))
    .filter((r) => r.entered > 0)
    .sort((a, b) => b.entered - a.entered || a.value.localeCompare(b.value));
  const head = rows.slice(0, limit);
  const tail = rows.slice(limit);
  const out = head.map((r) => ({ value: r.value, steps: funnel(keys, r.groups) }));
  if (tail.length) out.push({ value: other, steps: funnel(keys, tail.flatMap((r) => r.groups)) });
  return out;
}
