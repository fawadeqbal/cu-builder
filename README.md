# CV Builder

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
- **Two templates.**
  - **Classic:** Europass style, with section labels in a left column, a blue accent and justified text.
  - **Modern:** serif name, contact block on the right, and a two-column body with a side panel.
- **CV check** before download, with links to fix anything missing.
- **PDF export** through the browser's print engine, so the text stays selectable and links stay clickable.
- **Auto-save** in your browser (`localStorage`). There is no server or account, and you continue where you left off.
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
npm install
npm run dev
```

Open http://localhost:3000.

## Downloading the PDF

1. Click **Download PDF**.
2. In the print window, choose **Save as PDF** as the destination.
3. Turn off **Headers and footers** (under "More settings").
4. Save.

Chrome and Edge give the best result.

## Project structure

```
src/
├── app/
│   ├── globals.css        # app styles, both templates and print rules (@page A4)
│   ├── layout.tsx         # fonts (Inter, Source Serif 4) and metadata
│   └── page.tsx
├── components/
│   ├── Builder.tsx        # app shell: welcome or wizard, preview, import/export, PDF, auto-save
│   ├── BuilderLoader.tsx  # client-only loading (reads localStorage)
│   ├── SplitView.tsx      # editor + preview panes with the draggable, collapsible divider
│   ├── ViewSwitcher.tsx   # Edit / Split / Preview segmented control
│   ├── Preview.tsx        # live A4 preview: toolbar, zoom, click-to-edit, mini thumbnail
│   ├── Welcome.tsx        # start screen
│   ├── Wizard.tsx         # progress bar, step content, tips, validation, Back/Next
│   ├── sections.tsx       # the form for each step
│   ├── FinishStep.tsx     # template picker, CV check, download
│   ├── fields.tsx         # inputs and list item cards
│   └── icons.tsx          # small inline SVG icons
├── lib/
│   ├── cv.ts              # helpers, JSON validation, storage, template list
│   ├── progress.ts        # CV check, CV strength and each step's status line
│   ├── layout.ts          # view mode, pane width, side and zoom (saved separately from the CV)
│   ├── sample.ts          # example CV
│   ├── steps.ts           # wizard steps, titles and tips
│   └── types.ts           # CV data types
└── templates/
    ├── ClassicTemplate.tsx
    ├── ModernTemplate.tsx
    └── index.tsx          # picks the template to render
```

## Adding a new template

1. Create `src/templates/MyTemplate.tsx`. It receives `{ cv }` and returns the markup.
2. Add its styles to `globals.css` under a unique class, for example `.tpl-mine`.
3. Add it to `TemplateId` in `lib/types.ts`, to `TEMPLATES` in `lib/cv.ts` and to `templates/index.tsx`.
4. Put `data-step="<step id>"` (`personal`, `summary`, `experience`, …) on each section, so clicking it in the preview opens the right step.

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

The app is exported as a static site (`output: "export"`), so it can be hosted anywhere.

**GitHub Pages (set up):** every push to `main` runs `.github/workflows/deploy.yml`, which lints, builds and publishes the `out/` folder. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions** (only needed once).

**Vercel / Netlify:** import the repository and deploy. The build command is `npm run build` and the output folder is `out`.

## Roadmap

- More templates and accent colours
- Section ordering and hiding
- Multiple saved CVs
- AI help to tailor a CV to a job description
