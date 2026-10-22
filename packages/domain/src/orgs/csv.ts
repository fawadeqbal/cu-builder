import { isOrgRole, type OrgRole } from "./roles";

export type InviteRow = { line: number; email: string; role: OrgRole; cohort: string };
export type CsvError = { line: number; message: string };

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Splits one CSV line, honouring double quotes ("a, b" stays one cell). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";" || c === "\t") {
      cells.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

/** Quotes a cell for CSV output when needed. Guards against spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (header: string[], rows: unknown[][]): string => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

const ROLE_WORDS: Record<string, OrgRole> = { student: "member", member: "member", reviewer: "reviewer", admin: "admin", recruiter: "recruiter", staff: "reviewer" };

/**
 * Reads an invite list: one person per line, `email[,role][,cohort]`, with or without a header
 * row (columns found by name when there is one). Invalid lines become errors; repeats are
 * dropped. Owners can't be invited in bulk.
 */
export function parseInviteCsv(text: string, opts: { defaultRole?: OrgRole; max?: number } = {}): { rows: InviteRow[]; errors: CsvError[] } {
  const max = opts.max ?? 1000;
  const defaultRole = opts.defaultRole ?? "member";
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows: InviteRow[] = [];
  const errors: CsvError[] = [];
  const seen = new Set<string>();
  let col = { email: 0, role: 1, cohort: 2 };
  let start = 0;
  const first = lines.findIndex((l) => l.trim());
  if (first >= 0) {
    const head = splitCsvLine(lines[first]!).map((h) => h.toLowerCase());
    if (head.some((h) => /e-?mail/.test(h))) {
      const find = (re: RegExp) => head.findIndex((h) => re.test(h));
      col = { email: find(/e-?mail/), role: find(/role|type/), cohort: find(/cohort|class|batch|group|year|programme|program/) };
      start = first + 1;
    }
  }
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]!;
    if (!raw.trim()) continue;
    const line = i + 1;
    const cells = splitCsvLine(raw);
    const email = (cells[col.email] ?? "").toLowerCase();
    if (!EMAIL.test(email)) {
      errors.push({ line, message: email ? `"${email.slice(0, 60)}" isn't an email address` : "No email address" });
      continue;
    }
    const roleWord = col.role >= 0 ? (cells[col.role] ?? "").toLowerCase() : "";
    const role = roleWord ? ROLE_WORDS[roleWord] ?? (isOrgRole(roleWord) ? roleWord : null) : defaultRole;
    if (!role || role === "owner") {
      errors.push({ line, message: `Unknown role "${roleWord}" (use student, reviewer, admin or recruiter)` });
      continue;
    }
    if (seen.has(email)) {
      errors.push({ line, message: `${email} is listed twice` });
      continue;
    }
    if (rows.length >= max) {
      errors.push({ line, message: `Only ${max} invites at a time` });
      break;
    }
    seen.add(email);
    rows.push({ line, email, role, cohort: col.cohort >= 0 ? (cells[col.cohort] ?? "").slice(0, 80) : "" });
  }
  return { rows, errors };
}
