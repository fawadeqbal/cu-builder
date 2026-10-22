# Accessibility and right-to-left

## Accessibility

- **Contrast:** text tokens meet 4.5:1 on their grounds in both themes; control borders, focus rings and meaningful icons meet 3:1.
- **Keyboard:** everything works with Tab, Shift+Tab, Enter, Space, Escape and arrow keys. Dragging on the tracker always has a "Move to" alternative. Shortcuts (Alt+1/2/3 for editor views, `/` for search) never replace a visible control.
- **Focus:** visible on every control (`--focus-ring`); dialogs and drawers trap focus and return it to their trigger.
- **Names:** icon-only controls have labels (`IconButton` requires one); images of CVs have the CV's title as alt text; decorative icons are hidden from screen readers.
- **Live regions:** toasts and save status use `role="status"`; errors that block use `role="alert"`.
- **Touch:** targets at least `touch-min` (44px) on phones; no hover-only actions.
- **Motion:** honour `prefers-reduced-motion`.
- **Language:** set `lang` on `<html>` and on any text in another language (a Urdu name in an English CV) so screen readers and fonts switch.

## Right-to-left (Urdu, Arabic)

- The interface language sets `dir="rtl"` on `<html>`; a CV's direction is its own setting and can differ from the interface.
- Use logical properties only: `margin-inline-start`, `padding-inline`, `inset-inline-end`, `border-inline-start`, `text-align: start` (Tailwind `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`). Never `left`/`right`.
- Mirror: navigation order, drawers (they open from the left), arrows, chevrons, progress direction, the tracker board's column order, breadcrumbs.
- Don't mirror: logos, the CV sheet's own content when the CV is LTR, media controls, clocks, charts' time axes, phone numbers, emails, URLs and code (wrap them in `dir="ltr"`).
- Fonts: IBM Plex Sans Arabic for Arabic, Noto Nastaliq Urdu for Urdu, one step larger than Latin body text, with taller lines (`body-ar`, `body-ur`).
- No uppercase or letter-spacing in Arabic script; overlines become normal-case labels.
- Numerals: Western digits by default in both languages (most CVs and job boards use them); dates and currencies follow the locale's format.
