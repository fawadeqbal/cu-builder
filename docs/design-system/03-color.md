# Colour

Two brand colours (EU blue and gold) on true neutral greys, a status set, and the white page. The light theme is grey, not white: pages sit on a mid-light grey, the app bar is a solid blue band, and text is charcoal, not blue. Every colour is a token with a light and a dark value; components never use raw hex.

## Brand

| Token | Role |
| --- | --- |
| `brand` (EU blue `#004494`) | The one primary action, selected controls, the side-nav current marker, progress fills, focus. |
| `brand-soft` | Selected rows and chips, brand badges, AI panels. |
| `brand-ink` | Brand-coloured text: links and brand badges only. Headings, labels, active tabs and current navigation stay in `ink`. |
| `on-brand` | Text and icons on `brand`. |
| `gold` | Ratings, Premium, "Most chosen", the mark's folded corner. A fill, never text on light grounds. |
| `gold-soft` / `gold-ink` | Highlight badges, found keywords (like a highlighter), AI placeholders. |

Blue leads; gold appears in small doses, two or three times per screen at most.

## The app bar

`appbar-bg` is a solid blue band in light (a dark bar in dark), with `appbar-ink` for the logo and current link, `appbar-ink-2` for the other links, `appbar-hover` for hovered controls and a gold `appbar-accent` underline under the current link. It is the one large block of blue on a screen.

## Neutrals

`canvas` (grey `#ebebeb`, the desk) → `surface` (cards, bars) → `surface-2` (quiet fills, table heads) → `surface-3` (tracks, skeletons). Lines: `line` for dividers and card borders, `line-strong` for dividers that must read, `line-control` (3:1) for the borders of inputs, checkboxes and secondary buttons. Text: `ink` for headings and body, `ink-2` for labels and secondary text, `ink-3` for hints and meta (all 4.5:1 on `surface`, `surface-2` and `canvas`), `ink-disabled` for disabled controls only.

## Status

| State | Token | Ground | Always with |
| --- | --- | --- | --- |
| Done, passed, offer | `success` | `success-soft` | check icon or "Done" |
| Needs attention soon | `warning` | `warning-soft` | clock or alert icon |
| Error, destructive | `danger` | `danger-soft` | alert or x icon, the fix in words |
| News, tips, applied | `info` | `info-soft` | info or lightbulb icon |

`warning` is a burnt orange so it never reads as gold's good news.

## Data colours

Tracker stages use `stage-saved` (grey), `stage-applied` (blue), `stage-interview` (violet), `stage-offer` (green) and `stage-rejected` (muted brick). Use them in this order in charts. Plan tiers use `tier-*-bg` grounds.

## The page

`paper` is white in both themes because the CV prints. Text on the sheet comes from the CV templates and their accent palette, never from interface tokens. The preview canvas behind it uses `canvas` with a `canvas-dot` grid.

## Contrast

All text tokens meet 4.5:1 on the grounds their usage notes name, in both themes; `line-control`, `focus` and `brand` meet 3:1 as control boundaries and marks. The dark theme uses neutral charcoal greys and raises the brand to a light EU blue with dark `on-brand` text rather than keeping white text on a dim fill.
