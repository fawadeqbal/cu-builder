"use client";

import { formatBucket, formatCount, formatPercent } from "./format";

export type CohortRowData = { week: string; size: number; cells: ({ users: number; rate: number } | null)[] };

/** Sequential step (0–7) for a retention rate: 0 is nobody, 7 is everyone. */
export const cohortStep = (rate: number): number => (rate <= 0 ? 0 : Math.min(7, Math.max(1, Math.ceil(rate * 7))));

/**
 * Weekly retention as a heatmap that is also the table: rows are sign-up weeks, columns weeks
 * since sign-up, each cell's colour (one blue ramp, light to dark; flipped in dark mode) and
 * printed percentage give the share who came back. Weeks still to come are left empty.
 */
export function CohortHeatmap({ rows, weeks, average }: { rows: CohortRowData[]; weeks: number; average?: (number | null)[] }) {
  const cols = Array.from({ length: weeks + 1 }, (_, k) => k);
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-separate border-spacing-0.5 text-xs">
          <caption className="cvb-sr">Share of each sign-up week&apos;s people who were active in each week after signing up</caption>
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-start font-semibold text-ink-3">
                Signed up
              </th>
              <th scope="col" className="px-2 py-1 text-end font-semibold text-ink-3">
                People
              </th>
              {cols.map((k) => (
                <th key={k} scope="col" className="px-1 py-1 text-center font-semibold text-ink-3">
                  {k === 0 ? "Week 0" : `+${k}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.week}>
                <th scope="row" className="whitespace-nowrap px-2 py-1 text-start font-medium text-ink-2">
                  {formatBucket(r.week, true)}
                </th>
                <td className="cvb-num px-2 py-1 text-end text-ink-2">{formatCount(r.size)}</td>
                {cols.map((k) => {
                  const c = r.cells[k];
                  if (!c)
                    return (
                      <td key={k} className="px-1 py-1 text-center text-ink-disabled">
                        <span aria-label="Not yet">·</span>
                      </td>
                    );
                  const step = cohortStep(c.rate);
                  return (
                    <td
                      key={k}
                      className="cvb-num rounded-[3px] px-1 py-1.5 text-center font-semibold"
                      style={{ background: `var(--viz-seq-${step})`, color: step >= 5 ? "var(--viz-seq-ink-high)" : "var(--viz-seq-ink-low)" }}
                      title={`${formatCount(c.users)} of ${formatCount(r.size)} people`}
                    >
                      {formatPercent(c.rate)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {average && rows.length > 1 && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={2} className="px-2 py-1 text-start font-semibold text-ink">
                  Average
                </th>
                {cols.map((k) => (
                  <td key={k} className="cvb-num px-1 py-1 text-center font-semibold text-ink">
                    {average[k] === null || average[k] === undefined ? "·" : formatPercent(average[k]!)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-3" aria-hidden="true">
        <span>0%</span>
        <span className="flex overflow-hidden rounded-[3px]">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => (
            <span key={s} className="h-2.5 w-5" style={{ background: `var(--viz-seq-${s})` }} />
          ))}
        </span>
        <span>100% came back</span>
      </div>
    </div>
  );
}
