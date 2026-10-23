/** CSV export for the tables under every chart. */

export type CsvColumn<R> = { label: string; value: (row: R) => string | number | null | undefined };

const cell = (v: string | number | null | undefined): string => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote when needed; neutralise spreadsheet formulas (a leading = + - @).
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv<R>(rows: readonly R[], columns: readonly CsvColumn<R>[]): string {
  return [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))].join("\r\n");
}

/** A byte-order mark, so spreadsheet apps read the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** Saves `csv` as a file in the browser. */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
