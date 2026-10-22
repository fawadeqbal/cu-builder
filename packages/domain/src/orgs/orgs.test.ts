import { describe, expect, it } from "vitest";
import { emptyCV } from "../resume/model";
import type { CV } from "../resume/types";
import { lowConfidenceFields, withoutContacts } from "./candidates";
import { cohortMetrics, studentRow } from "./cohort";
import { csvCell, parseInviteCsv, splitCsvLine, toCsv } from "./csv";
import { canAssignRole, emailDomain, hasFreeSeat, normalizeDomains, orgCan, seatUpgrade, seatsUsed } from "./roles";

describe("org roles", () => {
  it("gives each role its actions", () => {
    expect(orgCan("owner", "members.manage")).toBe(true);
    expect(orgCan("reviewer", "cv.review")).toBe(true);
    expect(orgCan("reviewer", "members.manage")).toBe(false);
    expect(orgCan("recruiter", "candidates.manage")).toBe(true);
    expect(orgCan("member", "cohort.view")).toBe(false);
    expect(orgCan("nobody", "org.view")).toBe(false);
  });
  it("keeps owner changes for owners", () => {
    expect(canAssignRole("admin", "member", "reviewer")).toBe(true);
    expect(canAssignRole("admin", "member", "owner")).toBe(false);
    expect(canAssignRole("admin", "owner", "member")).toBe(false);
    expect(canAssignRole("owner", "admin", "owner")).toBe(true);
    expect(canAssignRole("reviewer", "member", "admin")).toBe(false);
  });
  it("counts seats and upgrades plans", () => {
    const members = [{ seat: true }, { seat: false }, { seat: true }];
    expect(seatsUsed(members)).toBe(2);
    expect(hasFreeSeat(2, members)).toBe(false);
    expect(hasFreeSeat(3, members)).toBe(true);
    expect(seatUpgrade("free", ["standard", "premium"])).toBe("premium");
    expect(seatUpgrade("premium", ["standard"])).toBeNull();
  });
  it("normalises SSO domains", () => {
    expect(emailDomain("Ali@Uni.EDU.pk")).toBe("uni.edu.pk");
    expect(normalizeDomains(["@uni.edu.pk", "https://Uni.edu.pk/", "bad", "x.org"])).toEqual(["uni.edu.pk", "x.org"]);
  });
});

describe("invite CSV", () => {
  it("reads lines with and without a header", () => {
    const a = parseInviteCsv("ali@uni.edu,student,2026\nsara@uni.edu,reviewer\n\nbad-line\nali@uni.edu");
    expect(a.rows.map((r) => [r.email, r.role, r.cohort])).toEqual([
      ["ali@uni.edu", "member", "2026"],
      ["sara@uni.edu", "reviewer", ""],
    ]);
    expect(a.errors.map((e) => e.line)).toEqual([4, 5]);
    const b = parseInviteCsv('Name,Email,Cohort\n"Khan, Ali",ALI@x.edu,BSCS 2026\n');
    expect(b.rows).toEqual([{ line: 2, email: "ali@x.edu", role: "member", cohort: "BSCS 2026" }]);
    expect(parseInviteCsv("a@x.io,owner").errors[0]!.message).toMatch(/Unknown role/);
  });
  it("splits quoted cells and writes safe CSV", () => {
    expect(splitCsvLine('"a, b",c,"say ""hi"""')).toEqual(["a, b", "c", 'say "hi"']);
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(toCsv(["a", "b"], [["x,y", 1]])).toBe('a,b\n"x,y",1\n');
  });
});

const cv = (patch: Partial<CV["personal"]>, exp: CV["experience"] = []): CV => ({ ...emptyCV, personal: { ...emptyCV.personal, ...patch }, experience: exp });

describe("cohort metrics", () => {
  it("aggregates students", () => {
    const now = new Date("2026-10-22T00:00:00Z");
    const rows = [
      studentRow({
        userId: "u1",
        name: "Ali",
        email: "a@x",
        cohort: "2026",
        role: "member",
        resumes: [{ id: "r1", cv: cv({ name: "Ali", email: "a@x" }), templateAts: true, updatedAt: now }],
        applications: [
          { status: "applied", appliedAt: now, interviewAt: null, updatedAt: now },
          { status: "offer", appliedAt: now, interviewAt: now, updatedAt: now },
        ],
        lastActiveAt: now,
      }),
      studentRow({ userId: "u2", name: "Sara", email: "s@x", cohort: "2026", role: "member", resumes: [], applications: [], lastActiveAt: null }),
    ];
    expect(rows[0]!.bestResumeId).toBe("r1");
    expect(rows[0]!.interviews).toBe(1);
    const m = cohortMetrics(rows, now);
    expect(m).toMatchObject({ students: 2, withCv: 1, withCvPct: 50, applications: 2, offers: 1, placed: 1, active30: 1 });
    expect(m.avgAts).toBe(rows[0]!.bestAts);
  });
});

describe("candidate checks", () => {
  it("flags what a recruiter should review", () => {
    const flags = lowConfidenceFields(cv({ name: "Ali Khan", email: "a@x.io" }, [{ id: "e", role: "Dev", company: "", location: "", date: "a while", bullets: [], stack: "" }]));
    const paths = flags.map((f) => f.path);
    expect(paths).toContain("personal.phone");
    expect(paths).toContain("experience.0.company");
    expect(paths).toContain("experience.0.date");
    expect(paths).not.toContain("personal.name");
    expect(withoutContacts(cv({ email: "a@x", phone: "1", location: "Street 1, Lahore" })).personal).toMatchObject({ email: "", phone: "", location: "Lahore" });
  });
});
