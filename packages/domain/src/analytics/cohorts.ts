/** Weekly retention cohorts: people grouped by sign-up week, and who came back in each later week. */

export type CohortCell = { users: number; rate: number } | null;
export type CohortRow = { week: string; size: number; cells: CohortCell[] };

const WEEK = 7 * 86_400_000;

/**
 * Builds the cohort table. `activity` holds distinct active users per (cohort week, weeks since
 * sign-up). Week 0 is the sign-up week. Cells that haven't happened yet (the week starts after
 * `now`) are null, so a young cohort isn't read as "nobody came back".
 */
export function buildCohorts(input: {
  cohorts: readonly { week: string; size: number }[];
  activity: readonly { week: string; offset: number; users: number }[];
  weeks?: number;
  now?: Date;
}): CohortRow[] {
  const weeks = input.weeks ?? 8;
  const now = (input.now ?? new Date()).getTime();
  const active = new Map(input.activity.map((a) => [`${a.week}|${a.offset}`, a.users]));
  return [...input.cohorts]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(({ week, size }) => {
      const start = new Date(`${week}T00:00:00.000Z`).getTime();
      const cells: CohortCell[] = [];
      for (let k = 0; k <= weeks; k++) {
        if (start + k * WEEK > now) {
          cells.push(null);
          continue;
        }
        // Week 0 is everyone who signed up, by definition.
        const users = k === 0 ? Math.max(size, active.get(`${week}|0`) ?? 0) : Math.min(size, active.get(`${week}|${k}`) ?? 0);
        cells.push({ users, rate: size > 0 ? users / size : 0 });
      }
      return { week, size, cells };
    });
}

/** Average retention per week offset across cohorts, weighted by cohort size (only cohorts that reached it). */
export function averageRetention(rows: readonly CohortRow[], weeks = 8): (number | null)[] {
  const out: (number | null)[] = [];
  for (let k = 0; k <= weeks; k++) {
    let users = 0;
    let size = 0;
    for (const r of rows) {
      const c = r.cells[k];
      if (c) {
        users += c.users;
        size += r.size;
      }
    }
    out.push(size > 0 ? users / size : null);
  }
  return out;
}
