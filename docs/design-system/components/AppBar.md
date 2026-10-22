# AppBar

The app bar is the global navigation on every signed-in page: the mark, the six product areas, then language, theme and the account menu.

## Anatomy

`Logo` → main links (My CVs, Jobs, Tracker, Interview, Experts, Letters) → at the inline end: `LanguageSwitcher`, `ThemeToggle` (in the account menu on phones), an Upgrade `Button` (`highlight`, Free plan only) and the account `Avatar` that opens a `Menu`.

## The consumer provides

- `links` (`{ href, label, current }`; exactly one `current`, matched by path prefix), `end` (the inline-end controls), `product` (white-label partners pass their product name; the mark comes from branding).

## Rules

- `app-bar-height` (56px), sticky at the top with `z-app-bar`; a `line` border, no shadow.
- In light the bar is a solid `appbar-bg` blue band with white links (`appbar-ink`, others `appbar-ink-2`); in dark it is `surface`. The current link gets a 3px `appbar-accent` underline (gold in light) flush with the bar's bottom edge.
- Components placed in `end` work unchanged: the bar re-points `ink`, `ink-3` and `surface-2` to its own inks.
- Below `bp-md` the links scroll horizontally; below `bp-sm` they move into a menu button and only the mark, Upgrade and avatar stay.
- Secondary areas (Organisations, Expert workspace, My website, Orders, Account, Admin) live in the account menu, not the bar.
- Mirrors in right-to-left: the mark sits at the right, the account menu at the left.
