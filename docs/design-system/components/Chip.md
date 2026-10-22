# Chip

Chips are compact toggles and tokens: filter options (Style, Layout, Remote), job titles in preferences, skills.

## The consumer provides

- `children`, `selected` + `onToggle` for filters (renders `aria-pressed`), `onRemove` for removable tokens, optional `icon`.

## Rules

- Selected chips switch to `brand-soft` with a `brand` border, `ink` text and a check icon, so the state reads without colour.
- A row of filter chips sits above the list it filters, with a "Clear" link once any is on.
