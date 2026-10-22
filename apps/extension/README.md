# CV Builder browser extension (Chrome, Manifest V3)

Save a job posting to your tracker in one click, see how well a CV matches it, and fill the
basic fields of an application form after you review them. Nothing is ever submitted for you.

## Build and load

```bash
pnpm --filter @cvb/extension build      # bundles into apps/extension/dist
```

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick `apps/extension/dist`.
2. In CV Builder, open **Account → Browser extension** and create a key (it starts with `cvb_` and is shown once).
3. The extension's settings page opens after install (or right-click the icon → Options). Enter your CV Builder
   address (for local development `http://localhost:3000`; the API is reached at `<address>/api/v1`) and paste the key.
   Chrome asks once for access to that address. **Save and test connection** shows the account it connected to.

Rebuild after changes and click the reload icon on the extension's card.

## What it does

| Action | How |
| --- | --- |
| Save to tracker | Reads the page when you open the popup: site layouts for LinkedIn, Indeed, Rozee.pk and Bayt, then schema.org `JobPosting` JSON-LD, then Open Graph tags. You can edit every field before `POST /api/v1/applications` (the job is saved with source `extension`). Free-plan limits show a link to the pricing page. |
| Match % | Pick one of your CVs; the score and missing keywords are computed in the popup with `matchJob` from `@cvb/domain`, the same rules the app uses. |
| Fill application form | Finds name, email, phone, city/location, LinkedIn, GitHub, website and current-title fields by `autocomplete`, type, name, id, label and placeholder. An on-page panel lists each field and value with a checkbox (fields you already typed in start unticked); only ticked fields are filled, and filled fields are highlighted. It never clicks submit. |

## Permissions

- `activeTab` + `scripting`: the page is read only when you open the popup on it, and the content script is injected on demand.
- `storage`: the app address, the key and the last CV you chose, stored locally in this browser.
- Optional host access to your CV Builder address only, asked when you save settings, so the extension can call its API.

## Code

- `src/lib/extract.ts`, `jsonld.ts`, `text.ts`: page reading (pure functions on a `Document`).
- `src/lib/fields.ts`: which form field asks for what, and the values a CV gives.
- `src/content/`: the injected script (`fill.ts` plans and sets values; `panel.ts` is the review panel in a shadow root).
- `src/popup.ts`, `src/options.ts`, `src/background.ts`, `static/`: the extension pages and manifest.
- `build.mjs`: esbuild bundle plus generated PNG icons.

`pnpm --filter @cvb/extension test` runs the extractor, field and autofill tests (Vitest with happy-dom).
