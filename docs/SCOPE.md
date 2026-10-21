# CV Builder: Product Scope (Phases 1–4)

| | |
| --- | --- |
| **Product** | CV Builder: resume builder and job-seeker services (SaaS) |
| **Owner** | Fawad Iqbal |
| **Status** | Draft for review |
| **Date** | 22 October 2026 |
| **Repository** | `fawadeqbal/cu-builder` |

---

## 1. Summary

CV Builder already lets people write a CV step by step, preview it live, switch between 12 templates in four tiers, and download a clean A4 PDF. Everything runs in the browser and is saved only on that device.

This document scopes the move from a free, single-device tool to a **paid SaaS for job seekers**. The work runs in four phases:

| Phase | Theme | Outcome |
| --- | --- | --- |
| **1** | Platform foundation | Accounts, cloud storage, multiple CVs, CV import, share links, paid plans |
| **2** | Resume intelligence | AI writing, ATS score, job-description match, tailoring, cover letters |
| **3** | Job search tools | Application tracker, browser extension, job feed, interview preparation |
| **4** | Services and scale | Expert marketplace, B2B (universities, recruiters), localization, regional formats |

Each phase ships something people will pay for, and each builds on the one before it.

---

## 2. Goals and non-goals

### Goals

1. Turn the existing builder into a product people pay for, with clear Free, Standard, Premium and Executive plans.
2. Keep the builder fast and simple: the core flow (write → preview → download) must never get slower or harder.
3. Help people **get interviews**, not just make documents: match CVs to jobs, track applications, prepare for interviews.
4. Serve Pakistan first (local payments, local job boards, local CV conventions), then the Gulf, UK, EU and US.
5. Open B2B revenue through universities and recruiters in Phase 4.

### Non-goals (all phases)

- Becoming a job board or an applicant tracking system for employers.
- Auto-applying to jobs on the user's behalf without review.
- A native mobile app (the web app stays fully responsive; native apps can follow later).
- Recruiter search over job seekers' CVs (privacy risk; reconsider only with explicit opt-in).

---

## 3. Users

| Persona | Needs | Plan they fit |
| --- | --- | --- |
| **Student / fresh graduate** | First CV, projects over experience, guidance on what to write | Free → Standard |
| **Active job seeker** | Tailor CVs to many jobs quickly, track applications, beat ATS filters | Premium |
| **Career switcher** | Reframe experience for a new field, cover letters that explain the change | Premium |
| **Senior professional / executive** | Polished design, human expert review, coaching | Executive |
| **Career centre (B2B)** | Licences for students, cohort progress, placement data | Institution plan |
| **Recruiter / agency (B2B)** | Reformat candidate CVs into a branded template in bulk | Agency plan |

---

## 4. Current state (baseline)

What exists today in the repository:

- Next.js app, **static export** to GitHub Pages; no server or database.
- Step-by-step editor (8 steps) with a step rail, CV-strength ring and validation.
- Edit / Split / Preview workspace, resizable divider, click-to-edit preview, zoom.
- 12 templates in four tiers (Basic, Standard, Premium, Executive) with 12 accent colours and a template gallery page with filters.
- Direct PDF download (selectable text layer, clickable links) and a print fallback.
- Data in `localStorage` only; JSON backup import and export.
- `isUnlocked(tier)` hook ready for plan gating.

**Key consequence:** Phase 1 must move the app from static hosting to a server-backed deployment.

---

## 5. Plans and pricing model

Prices are placeholders to be set after market testing.

| Capability | Free (Basic) | Standard | Premium | Executive |
| --- | --- | --- | --- | --- |
| CVs | 1 | Unlimited | Unlimited | Unlimited |
| Templates | Basic | Basic + Standard | All | All |
| PDF download | ✓ (small footer credit) | ✓ | ✓ | ✓ |
| DOCX / TXT export | — | ✓ | ✓ | ✓ |
| Share link + QR | — | ✓ | ✓ + view analytics | ✓ + view analytics |
| ATS score | Score only | Full report | Full report | Full report |
| AI writing | 3 tries | Limited monthly credits | Generous credits | Generous credits |
| Job-description match and tailoring | — | — | ✓ | ✓ |
| Cover letters | — | ✓ | ✓ + AI | ✓ + AI |
| Application tracker | 10 jobs | Unlimited | Unlimited | Unlimited |
| Interview preparation | — | — | ✓ | ✓ |
| Human expert review | — | — | Paid add-on | 1 included per period |
| Support | Help centre | Email | Priority email | Priority + coach chat |

**Billing options:** monthly, yearly (discounted), and one-time **Job-Hunt Passes** (7 and 30 days), which suit people who only need the product while they are looking.

**Add-ons:** AI credit packs, rush expert review (24 hours), extra coaching sessions.

**Free-tier policy:** all four template tiers stay previewable for everyone; only download and some features are gated. People should always be able to see what they would get.

---

## 6. Phase 1: Platform foundation

### 6.1 Objective

Give users an account, keep their CVs safe in the cloud on every device, and start charging.

### 6.2 In scope

#### A. Accounts and authentication
- Sign up and sign in with email (magic link or password), Google and LinkedIn.
- Email verification, password reset, sign out on all devices.
- **Guest-first:** people can still build without an account; on sign-up, their local CV migrates to the cloud automatically.
- Profile settings: name, email, locale, delete account, export all data.

#### B. Cloud storage and multiple CVs
- Dashboard ("My CVs") listing every CV with thumbnail, template, last edited and actions.
- Create, duplicate, rename, archive, delete (with 30-day trash).
- Autosave to the cloud with conflict handling (last write wins, with a "newer version on another device" notice).
- Offline-tolerant: edits queue locally and sync when back online.
- **Version history:** automatic snapshots (on download and daily), restore any snapshot.

#### C. CV import
- Upload PDF or DOCX → parsed into the editor's fields (name, contact, experience, education, skills).
- Review screen highlighting low-confidence fields before saving.
- LinkedIn profile import through the PDF that LinkedIn exports.

#### D. Exports
- PDF (existing), **DOCX** (editable, ATS-safe), plain **TXT** for portal copy-paste.
- **US Letter** page size alongside A4, chosen per CV.

#### E. Share links
- Public, read-only CV page at `/r/<slug>` with download button; regenerates when the CV changes.
- QR code for the link (for business cards and printed CVs).
- Controls: on/off, custom slug, password, expiry date.

#### F. Plans, billing and gating
- Plans and passes from section 5.
- **Payments:** Stripe for international cards; a local gateway for Pakistan (JazzCash / Easypaisa through an aggregator).
- Checkout, receipts and invoices by email, upgrade and downgrade, cancel at period end, failed-payment retries.
- Customer billing portal (change card, see invoices).
- Gating through the existing `isUnlocked()` plus a new `can(user, feature)` check; locked features show an upgrade prompt, never a dead end.

#### G. Admin console (internal)
- Users (search, plan, status), subscriptions and revenue, refunds.
- Template management: publish/unpublish, change tier, reorder, feature flags.
- Basic metrics: sign-ups, activation, conversion, churn.

#### H. Product analytics and email
- Event tracking (privacy-friendly) for the funnel: visit → start → complete → download → sign up → pay.
- Transactional email: welcome, verify, receipts, password reset, "your CV was viewed" (Phase 1 sends the email; analytics detail comes later).

### 6.3 User stories and acceptance criteria

| # | Story | Acceptance criteria |
| --- | --- | --- |
| 1.1 | As a guest, I can build a CV and sign up without losing it. | After sign-up, the CV appears in "My CVs" unchanged, including template and colour. |
| 1.2 | As a user, I can keep several CVs. | Create, duplicate, rename and delete work; deleted CVs are restorable for 30 days. |
| 1.3 | As a user, I can open my CV on another device. | Changes appear on the second device within 5 seconds of saving. |
| 1.4 | As a user, I can upload my old CV. | A typical one- or two-page PDF fills name, email, phone, jobs and education correctly in at least 85% of test files. |
| 1.5 | As a user, I can share a link. | The link opens without sign-in, shows the latest CV, and can be turned off instantly. |
| 1.6 | As a user, I can pay for a plan or pass. | Card and local payments complete; features unlock immediately; receipt arrives by email. |
| 1.7 | As a user, I can download an editable Word file. | The DOCX opens in Word and Google Docs with headings, bullets and links intact. |

### 6.4 Out of scope for Phase 1
AI features, cover letters, job tracking, view analytics detail, human services, B2B.

### 6.5 Success metrics
- 40% of people who start a CV finish and download it.
- 25% of downloaders create an account.
- 3–5% of active users pay within 30 days.
- Payment success rate above 95%.

---

## 7. Phase 2: Resume intelligence

### 7.1 Objective
Make CVs better and better targeted, which is the main reason people pay.

### 7.2 In scope

#### A. AI writing assistant
- **Improve bullet:** turns a plain duty into an achievement line; offers 3 options.
- **Write summary** from the person's experience and target job title.
- **Fix grammar and tone;** make shorter / more formal / more confident.
- **Quantify prompt:** detects bullets without numbers and asks a guided question ("How many users?").
- **Skills suggestions** from job title and experience.
- Inline in the editor: a small "✦ Improve" control beside each field, with accept / try again / undo.
- Credit metering per plan, with a visible counter.

#### B. ATS score and CV report
- Score out of 100 with sections: parsing safety (template, fonts, columns), completeness, impact (numbers, action verbs), length, readability, consistency (dates, tense).
- Each issue links to the exact field to fix (reuse click-to-edit).
- Runs automatically on the Download step; full report gated by plan.

#### C. Job-description match
- Paste a job ad or job link.
- Shows a **match %**, keywords found and missing, required vs nice-to-have skills, seniority fit.
- One-click "add missing keyword" suggestions placed in the right section.

#### D. Tailored copies
- "Tailor for this job" creates a copy linked to that job, with AI-suggested edits shown as a reviewable diff (accept all / one by one).
- Dashboard groups tailored copies under their base CV.

#### E. Cover letters
- Cover letter editor with templates matching each CV template's look.
- AI draft from CV + job ad + tone (formal, warm, concise); length control.
- PDF and DOCX export; share link.

#### F. Smart layout
- **Fit to one page:** adjusts spacing and font size in small steps until it fits, with a warning if text is too long.
- Page-break preview with "keep together" guidance.

### 7.3 User stories and acceptance criteria

| # | Story | Acceptance criteria |
| --- | --- | --- |
| 2.1 | As a user, I can improve a weak bullet. | Suggestions arrive within 5 seconds, keep facts from the original, and never invent employers, dates or numbers. |
| 2.2 | As a user, I see why my CV may fail an ATS. | Every issue in the report links to the field and explains the fix in one sentence. |
| 2.3 | As a user, I can check fit for a job. | Match % and missing keywords appear within 10 seconds of pasting a job ad. |
| 2.4 | As a user, I can tailor a CV safely. | Changes are shown as a diff; nothing changes until accepted; the original CV stays untouched. |
| 2.5 | As a user, I can create a matching cover letter. | Draft uses the person's real experience and the company/role from the ad. |

### 7.4 AI principles
- Never fabricate experience, qualifications or metrics; suggest placeholders like "[number]" when data is missing.
- The person always reviews before anything is applied.
- CV content is not used to train models; state this clearly in the privacy policy.
- Every AI call has cost limits per plan and abuse protection.

### 7.5 Success metrics
- 50% of paying users use AI writing weekly while job hunting.
- Average ATS score rises by 15+ points between first and final download.
- Premium conversion lifts by 30% over Phase 1 baseline.

---

## 8. Phase 3: Job search tools

### 8.1 Objective
Support the whole job hunt, so people stay subscribed while they apply and interview.

### 8.2 In scope

#### A. Application tracker
- Board view with columns: Saved, Applied, Interview, Offer, Rejected (customisable).
- Card: company, role, link, salary range, location, the CV and cover letter used, contacts, notes, dates.
- List and calendar views; filters and search.
- Reminders: follow up after N days, interview tomorrow, offer deadline.
- Weekly progress email ("6 applications, 2 interviews").

#### B. Browser extension (Chrome, then Edge and Firefox)
- Save a job from LinkedIn, Indeed, Rozee.pk, Bayt and company career pages into the tracker in one click.
- Shows match % for the open job against the chosen CV.
- **Autofill** common application form fields from the CV (with review before submit).

#### C. Job feed
- Jobs matched to the person's CV and preferences (title, location, remote, salary), sourced from licensed job APIs or partner feeds.
- Save to tracker, tailor CV, start cover letter, all from the job card.
- Daily or weekly job alert email.

#### D. Interview preparation
- **Question bank** by role, seniority and competency, with model answers.
- **AI mock interview:** text or voice; asks role-specific questions, follows up, and scores each answer on structure, relevance and clarity.
- **STAR story builder:** turns CV achievements into Situation-Task-Action-Result stories, saved for reuse.
- Company research sheet: notes, values, recent news links, questions to ask.

#### E. Offer and salary
- Offer comparison (salary, benefits, location, growth) side by side.
- Negotiation email templates.
- Salary ranges by role and city where reliable data is available.

#### F. Share-link analytics (completing Phase 1 links)
- Views, unique viewers, time on page, downloads, rough location and referrer per link.
- One link per application, so the person can see which employer opened it.

### 8.3 User stories and acceptance criteria

| # | Story | Acceptance criteria |
| --- | --- | --- |
| 3.1 | As a user, I can track all my applications in one place. | Cards move between columns by drag and drop; each card shows which CV version was sent. |
| 3.2 | As a user, I can save a job from a job site. | The extension captures title, company, location and description on the supported sites. |
| 3.3 | As a user, I can practise an interview. | A 10-question mock interview runs end to end with feedback for every answer. |
| 3.4 | As a user, I know when my CV is opened. | The owner sees a view within one minute and gets an optional email. |

### 8.4 Success metrics
- 60% of Premium users track at least 5 applications.
- Paid retention month-over-month above 70% during active job hunts.
- Extension installed by 30% of Premium users.

---

## 9. Phase 4: Services and scale

### 9.1 Objective
Add high-margin human services and B2B revenue, and serve more countries well.

### 9.2 In scope

#### A. Expert services marketplace
- **CV review:** a vetted expert leaves line-by-line comments in the editor within 48 hours (24-hour rush option).
- **Done-for-you CV writing** (Executive): intake questionnaire, call, drafts, two revision rounds.
- **Coaching sessions:** booking, calendar sync, video call link, notes saved to the user's account.
- **LinkedIn makeover** package.
- Expert onboarding, profiles, ratings, availability, payouts and platform commission.
- Quality controls: review scoring, refund policy, dispute handling.

#### B. B2B: universities and career centres
- Institution account with seat licences and a branded sign-up link.
- Cohort dashboard: who has a CV, average ATS score, applications, interviews, placements.
- Career-office reviewers can comment on student CVs.
- Bulk invites (CSV), SSO (Google Workspace / Microsoft), data export.

#### C. B2B: recruiters and agencies
- Upload candidate CVs in bulk → auto-parse → reformat into the agency's branded template.
- Hide or show contact details per client; batch PDF export.
- Team seats and roles.

#### D. White label
- Custom domain, logo, colours and template set for partners (institutes, job boards).

#### E. Localization and regional formats
- Interface languages: English, Urdu, Arabic (with right-to-left layouts), then others by demand.
- CV in right-to-left languages, with templates that mirror correctly.
- Regional presets: **US resume** (no photo, Letter size), **Europass**, **Gulf CV** (photo, nationality, visa status), **Pakistan / India** (personal details section), **UK CV**.
- Optional profile photo with crop and placement per template.

#### F. Portfolio site
- One-click personal site at `name.cvbuilder.app` (custom domain on paid plans) generated from the CV, with projects and contact form.

### 9.3 User stories and acceptance criteria

| # | Story | Acceptance criteria |
| --- | --- | --- |
| 4.1 | As a user, I can buy an expert review. | Payment, expert assignment, comments in the editor and a completion email, all within the promised time. |
| 4.2 | As a career centre, I can see my students' progress. | Dashboard shows cohort metrics and lets reviewers comment on a student's CV. |
| 4.3 | As an agency, I can reformat 50 CVs at once. | Bulk upload completes, each CV is parsed and exported in the agency template, with a review list of low-confidence fields. |
| 4.4 | As an Urdu or Arabic speaker, I can use the app in my language. | Interface and CV render right-to-left correctly in every supported template. |

### 9.4 Success metrics
- Services reach 20% of total revenue.
- 10 institution customers in the first year after launch.
- Expert review rating average 4.5/5 or higher.

---

## 10. Cross-cutting requirements

### 10.1 Architecture (recommended)

| Layer | Recommendation | Notes |
| --- | --- | --- |
| App | Next.js (keep), move from static export to a server deployment | Vercel, or a container on a VPS for cost control |
| Database | PostgreSQL | Managed (Neon, Supabase or similar) |
| ORM | Prisma or Drizzle | Typed access, migrations |
| Auth | Auth.js or a hosted provider | Email, Google, LinkedIn; SSO in Phase 4 |
| Files | S3-compatible storage | Imports, photos, exports |
| Payments | Stripe + local gateway | Webhooks drive plan state |
| AI | Claude API through a server-side service | Rate limits and credit metering per user |
| Jobs / queues | Background worker (e.g. a hosted queue) | Parsing, AI tasks, emails, exports |
| Email | Transactional email service | Templates for receipts, reminders, alerts |
| Analytics | Privacy-friendly product analytics | Funnel and feature usage |
| Monitoring | Error tracking + uptime | Alerts on payment and AI failures |

### 10.2 Core data model (Phase 1, extended later)

| Entity | Key fields |
| --- | --- |
| `User` | id, email, name, locale, plan, created_at |
| `Resume` | id, user_id, title, data (JSON), template_id, accent, page_size, archived_at |
| `ResumeVersion` | id, resume_id, data, created_at, reason |
| `ShareLink` | id, resume_id, slug, enabled, password_hash, expires_at |
| `Subscription` | id, user_id, plan, status, period_end, provider, provider_ref |
| `Pass` | id, user_id, kind (7d/30d), starts_at, ends_at |
| `CreditLedger` | id, user_id, delta, reason, created_at |
| *Phase 2* `Job`, `Match`, `CoverLetter` | |
| *Phase 3* `Application`, `Reminder`, `InterviewSession`, `LinkView` | |
| *Phase 4* `Expert`, `Order`, `Organization`, `Seat` | |

The CV body stays a versioned JSON document (as today), so the editor and templates need minimal change.

### 10.3 Non-functional requirements
- **Performance:** editor interactions under 100 ms; preview update under 200 ms; PDF under 3 seconds.
- **Availability:** 99.9% for app and share links.
- **Security:** HTTPS everywhere, encrypted data at rest, least-privilege access, rate limiting, audit log for admin actions.
- **Privacy:** data export and deletion on request; clear consent for analytics and AI; CV data never sold or used to train models.
- **Accessibility:** WCAG 2.2 AA for the app; templates readable by screen readers and ATS.
- **Browsers:** latest two versions of Chrome, Edge, Safari, Firefox; responsive down to 360 px.

### 10.4 Legal and compliance
- Terms of service, privacy policy, refund policy, cookie notice.
- Payment compliance handled by providers (no card data stored).
- Expert marketplace agreements (Phase 4): contractor terms, payouts, tax handling.

---

## 11. Timeline (indicative)

| Phase | Duration | Starts after |
| --- | --- | --- |
| Phase 1: Platform foundation | 6–8 weeks | Scope approval |
| Phase 2: Resume intelligence | 6–8 weeks | Phase 1 launch |
| Phase 3: Job search tools | 8–10 weeks | Phase 2 launch |
| Phase 4: Services and scale | 10–12 weeks | Phase 3 launch; B2B can start pilots earlier |

Durations assume a small team (2–3 engineers, 1 designer, part-time QA). Each phase ends with a public release.

---

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AI invents facts in a CV | Trust and legal risk | Strict prompts, "never invent" checks, mandatory review, placeholders for missing data |
| AI cost grows faster than revenue | Margin | Credits per plan, caching, cheaper models for simple tasks |
| CV import accuracy is low | Poor first impression | Confidence scores, review screen, test set of real CVs |
| Job sites block scraping | Extension breaks | Use page content the user is viewing; licensed job APIs for the feed |
| Local payment gateway friction | Lost conversions in Pakistan | Offer both card and wallet options; passes priced for local market |
| Moving off static hosting | Downtime, cost | Staged migration; keep guest mode working without an account |
| Marketplace quality varies | Refunds, reputation | Vetting, ratings, sample reviews, refund policy |

---

## 13. Open questions

1. Final prices and currency strategy (PKR and USD, or USD only)?
2. Which local payment aggregator for JazzCash / Easypaisa?
3. Hosting choice: managed platform or own VPS?
4. Should the free plan show a small "Made with CV Builder" footer on PDFs?
5. Which job APIs or partners for the Phase 3 feed?
6. Recruit experts directly, or partner with an existing career-services firm for Phase 4?
7. Which first B2B pilot: a university career centre or a recruitment agency?

---

## 14. Appendix: feature-to-phase map

| Feature | Phase |
| --- | --- |
| Accounts, cloud sync, multiple CVs, version history | 1 |
| CV import (PDF, DOCX, LinkedIn PDF) | 1 |
| DOCX / TXT export, US Letter | 1 |
| Share link, QR, password, expiry | 1 |
| Plans, passes, payments, gating, admin console | 1 |
| AI writing assistant, credits | 2 |
| ATS score and report | 2 |
| Job-description match, tailored copies | 2 |
| Cover letters (AI) | 2 |
| Fit to one page | 2 |
| Application tracker, reminders | 3 |
| Browser extension (save job, match, autofill) | 3 |
| Job feed and alerts | 3 |
| Interview prep, mock interviews, STAR stories | 3 |
| Offer comparison, negotiation | 3 |
| Share-link analytics | 3 |
| Expert review, writing, coaching marketplace | 4 |
| Universities and career centres | 4 |
| Recruiters and agencies, white label | 4 |
| Urdu / Arabic, right-to-left, regional CV formats, photo | 4 |
| Portfolio site | 4 |
