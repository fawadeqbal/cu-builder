# @cvb/ui — the CV Builder design system (Folio)

Tokens, styles and React components shared by the apps. Guides: `docs/design-system/`.

- `tokens.json`: the source of truth (colours for light and dark, type, spacing, radius, shadows, sizes). `node scripts/build-tokens.mjs` (runs on every build) writes `src/tokens.css`. Container widths are `--layout-*` because Tailwind owns `--container-*`.
- `src/styles.css`: the `cvb-*` component classes. Logical properties only, so everything mirrors in right-to-left.
- `src/ds.tsx`: React components (`Button`, `TextField`, `Tabs`, `Dialog`, `AppBar`, …). Wrap the app in `<UiProvider link={…} labels={…}>` to route links through the app's router and translate the built-in labels.
- `src/icons.tsx` / `src/icon-paths.ts`: the Folio icon set (24×24, 1.75 stroke, `currentColor`). Use `<Icon name="…" />`; the named `XxxIcon` components are kept for older call sites.
- `fonts/`: self-hosted Latin fonts and `fonts.css` for apps without next/font (the extension).

Themes: light on `:root`/`[data-theme="light"]`, dark on `[data-theme="dark"]`, and dark by system preference when no theme is set. In the web app, `globals.css` imports `@cvb/ui/tokens.css` and `@cvb/ui/styles.css` and maps every colour token to a Tailwind utility (`bg-surface`, `text-ink-2`, `border-line`, `bg-brand`, `text-on-brand`); Tailwind's own palette is switched off.
