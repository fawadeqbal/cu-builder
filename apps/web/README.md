# CV Builder — web app

> Part of the monorepo: run commands from the repo root (`pnpm dev:web`). Templates live in `packages/templates`, business rules in `packages/domain`, icons in `packages/ui`. See the root `README.md` and `ARCHITECTURE.md`.

Write your CV once, switch between templates, and download a clean A4 PDF. Built with Next.js, React and Tailwind CSS.

**Live:** https://fawadeqbal.github.io/cu-builder/

![Welcome screen](docs/welcome.png)

## How it works

1. **Start.** Create a new CV, begin from an example, or import a saved backup.
2. **Fill it in, one step at a time.** Details → Summary → Experience → Education → Skills → Projects → Extras. Each step has short tips, and the live preview updates as you type.
3. **Choose a design and download.** Pick a template, run the CV check, and download an A4 PDF.

![Experience step](docs/step.png)

## Features

- **Step-by-step wizard with a step rail.** Every step is listed on the left with its icon and what it holds ("2 jobs", "51 words"), done steps are ticked, and a CV-strength ring shows how close you are. The rail turns into icons when the editor is narrow and into a dropdown on phones. Required fields (name, job title, email) are checked before you move on.
- **Helpful inputs.** Summary starters with a word counter, quick-add skill groups, example placeholders and tips in every step.
- **12 templates in four tiers,** browsed on their own page (`/templates`):
  - **Basic:** Simple, Compact, Classic
  - **Standard:** Modern, Timeline, Nordic
  - **Premium:** Sidebar Pro, Developer, Creative
  - **Executive:** Elegant, Executive, Boardroom

  Filter by tier, style (Professional, Modern, Creative, Minimal, Executive), layout (one column, two columns, sidebar) and ATS-friendliness. Recolour every thumbnail with 12 accent colours, preview with your own CV or the example, open a large preview (← → to browse), and pick one. Quick switching also lives in the preview toolbar and on the Download step. Every tier is free to preview; downloading with a Standard, Premium or Executive template needs that plan (`isUnlocked()` in `lib/access.ts`). Admins can hide, re-tier and reorder templates.
- **CV check** before download, with links to fix anything missing.
- **One-click PDF download,** built in the browser with [modern-screenshot](https://github.com/qq15725/modern-screenshot) and [jsPDF](https://github.com/parallax/jsPDF): no print dialog. Pages break between lines and entries, the text stays selectable and searchable (an invisible text layer sits over the page image, so applicant tracking systems can read it), and links stay clickable.
- **Word (.docx) and plain text (.txt) exports** (Standard and up), and **A4 or US Letter** per CV.
- **Guests or accounts.** Without an account the CV auto-saves in the browser; after signing up it moves into the account automatically. Account CVs autosave to the server, keep working offline (edits sync when you're back), and show a notice if another device changed the CV meanwhile.
- **My CVs** dashboard: create, rename, duplicate, delete (30-day trash), and **upload a PDF or Word CV** to fill in the steps.
- **Version history** (on every download, daily while editing, or on request) with one-click restore.
- **Share links** with QR code, custom address, password and expiry; a public read-only page at `/r/<slug>`.
- **Pricing, checkout (Stripe) and billing portal**, account settings (password, sign out everywhere, export data, delete account) and an **admin console** (metrics, users, templates).
- **Backup files.** Save and import your CV as JSON.
- **Three views, one workspace.** Switch between **Edit**, **Split** and **Preview** from the header (`Alt+1` / `Alt+2` / `Alt+3`, or `Ctrl/⌘ + \` to show or hide the preview).
  - Drag the divider to resize. It snaps to the default width and to the middle, and double-click resets it. Drag a pane past its edge to hide it.
  - Swap sides to put the preview on the left. Your layout is remembered.
  - Zoom the preview with − / +, `Ctrl/⌘` + scroll or pinch, or fit it to the width or the whole page.
  - **Click any part of the preview to edit it.** The wizard jumps to that step, and the section you are editing is highlighted and scrolled into view.
  - In Edit view, a live thumbnail in the corner takes you back to the preview.
- **Mobile friendly,** with Edit / Preview tabs on phones.

![Download step](docs/finish.png)

## Getting started

```bash
pnpm install
pnpm dev:web
```

Open http://localhost:3000.

## Downloading the PDF

Click **Download PDF**. The file (`your-name-cv.pdf`, A4 or US Letter, 10/12 mm margins) is built in your browser in a second or two and saved straight away. Nothing is uploaded.

How it works (`src/lib/pdf.ts`): the CV is laid out off-screen at the printed width, drawn to a high-resolution image by the browser itself (so fonts and colours match the preview exactly), cut into A4 pages at clean gaps between lines and entries, and placed in a PDF with jsPDF. Every line of text is then written over the image as invisible PDF text, and every link becomes a clickable link.

Want a fully vector PDF instead? Open **⋯ → Print or save with the browser**, choose **Save as PDF**, and turn off **Headers and footers**.

## Project structure

```
apps/web/src/
├── app/                 # routes: / (guest builder), /app, /edit/[id], /templates, /r/[slug], /pricing,
│                        # /account, /account/billing, /admin, /sign-in, /sign-up, password pages
├── components/          # Builder, Wizard, SplitView, Preview, TemplateGallery, FinishStep, dialogs,
│                        # dashboard/, auth/, billing/, account/, admin/, share/
└── lib/
    ├── document.ts      # DocumentController: guest (localStorage) and cloud (API autosave) stores
    ├── cv.ts            # guest storage; guest-migration.ts moves it into an account
    ├── api.ts, queries.ts, auth-client.ts   # API client, TanStack Query hooks, Better Auth client
    ├── access.ts        # what the visitor can use (delegates to @cvb/domain)
    ├── catalog.ts       # template catalog with admin overrides
    ├── layout.ts        # workspace layout: view, pane width, side, zoom
    ├── pdf.ts, docx.ts  # direct PDF and Word downloads
    └── steps.ts         # wizard step titles and tips
```

Templates are in `packages/templates`, the CV model and checks in `packages/domain`, icons and the tier badge in `packages/ui`.

## Adding a new template

See "Adding things → A new CV template" in the root `ARCHITECTURE.md`.

## JSON format

Use **Export JSON** to see the full structure. In short:

```json
{
  "personal": { "name": "", "headline": "", "tagline": "", "email": "", "phone": "",
                "location": "", "website": "", "github": "", "linkedin": "", "extra": "" },
  "summary": "",
  "experience": [{ "role": "", "company": "", "location": "", "date": "", "bullets": [], "stack": "" }],
  "projects":   [{ "name": "", "date": "", "links": [], "bullets": [], "stack": "" }],
  "skills":     [{ "category": "", "items": "" }],
  "education":  [{ "degree": "", "school": "", "date": "", "details": "" }],
  "certificates": [{ "name": "", "issuer": "", "year": "", "url": "" }],
  "languages":  [{ "name": "", "level": "" }]
}
```

## Deploy

The web app is a Next.js server (`output: "standalone"`) that runs next to the API on a VPS, behind Caddy. See [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).

## Roadmap

- More templates and accent colours
- Section ordering and hiding
- Multiple saved CVs
- AI help to tailor a CV to a job description
