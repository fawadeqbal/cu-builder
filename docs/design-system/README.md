# CV Builder design system (Folio)

The same system as the published "CV Builder Product" design system. Code lives in `packages/ui`: `tokens.json` (source of truth) → `src/tokens.css` (generated), `src/styles.css` (cvb-* component classes) and `src/ds.tsx` (React components). The web app maps the tokens to Tailwind utilities in `apps/web/src/app/globals.css` (`bg-surface`, `text-ink-2`, `border-line`, `bg-brand`, `text-on-brand`, …); the extension copies the two stylesheets.

CV Builder helps people write a CV, find and track jobs, practise interviews and get expert help, in English, Urdu and Arabic. The identity is **Folio**: a white page on a grey desk under a blue band, one EU blue for action and a gold corner for the moments worth celebrating. The CV and the person's own words lead; the interface stays quiet around them.

## How to use this system

- Build every screen from the components here (`@cvb/ui`). Style anything new with the tokens, never raw values: colours from `color`, sizes from `spacing`, `radius`, `size`, type from the type styles.
- Read the guides in order before designing a screen: Principles, Voice, Colour, Type, Layout, Shape and motion, Navigation, Patterns, Accessibility and right-to-left, Theming, then the Screen map, which lists every screen in the product and the components it uses.
- Every screen ships in light and dark, left-to-right and right-to-left, and works at 360px wide.

## The rules that matter most

1. **One blue action per view.** `brand` fills exactly one button: the next step ("Continue to Summary", "Save to tracker", "Book"). Everything else is `secondary`, `ghost` or `link`.
2. **Gold celebrates, it never warns.** `gold` marks ratings, Premium, "New", found keywords and the folded corner of the mark. Warnings are `warning` (orange-brown), errors `danger`.
3. **Neutral ground, white paper.** Pages sit on grey `canvas` under the blue `appbar-bg` band; cards and dialogs on `surface` with a 1px `line` border; the CV sheet is always `paper` white, in both themes.
4. **Status is never colour alone.** Every `success`, `warning`, `danger` and `info` state carries a word and an icon.
5. **Logical sides only.** Use `start`/`end`, `inline`/`block` for every margin, padding, border and position, so layouts mirror for Urdu and Arabic without extra work.

## Content fundamentals

- Write to the person as **you**, in plain, short sentences. Sentence case everywhere: "Continue to Summary", "Save to tracker", "Email me when it's opened".
- Name the action, not the mechanism: "Download PDF", "Add application", "Use suggestion". Never "Submit", "OK" or "Click here".
- Facts, not judgements, in status lines: "4 jobs", "2 required left", "Due Fri 24 Oct".
- Errors say how to fix it: "Add the full address, like name@example.com."
- No emoji, no exclamation marks, no "Oops". Job hunting is stressful; the product stays calm.

## Visual foundations

- **Colour:** blue (`brand`) and gold (`gold`) on neutral greys (`canvas`, `surface`, `ink`); text is charcoal, blue is for actions and links only. Status: `success`, `warning`, `danger`, `info`, each with a `-soft` ground. Tracker stages: `stage-*`.
- **Type:** Schibsted Grotesk (`display`) for titles and big numbers, Instrument Sans (`sans`) for everything else, IBM Plex Mono (`mono`) for figures, IDs and keywords. IBM Plex Sans Arabic and Noto Nastaliq Urdu for right-to-left.
- **Space:** a 4px scale (`space-1` … `space-20`); `space-5` inside cards, `space-6` between them, `space-10` under the app bar.
- **Shape:** `radius-md` controls, `radius-lg` cards, `radius-xl` dialogs; flat by default, `shadow-md` and `shadow-lg` only for things that float.
- **Motion:** 120–320ms with `--ease-standard`; nothing moves for people who prefer reduced motion.

## Iconography

The Folio icon set: 68 icons on a 24px grid, 1.75 stroke, round caps and joins, drawn in `currentColor` (`Icon` component; SVG files in Assets › Icons). Sizes 16 / 20 / 24 (`icon-sm`, `icon-md`, `icon-lg`). Direction icons flip in right-to-left. No emoji, no icon fonts, no illustrations of people.

The mark is a blue page with a gold folded corner and two text lines; the wordmark is "CV Builder" in Schibsted Grotesk 750 (`Logo`; files in Assets › Logos).
