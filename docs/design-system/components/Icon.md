# Icon

Icons are the Folio set: 24×24, 1.75 stroke, round caps and joins, drawn in `currentColor`, 68 glyphs covering the whole product.

## The consumer provides

- `name` (see the grid), `size` (16 in badges and small buttons, 20 default, 24 for empty states and tiles), `label` only when the icon stands alone and carries meaning.

## Rules

- Icons inherit text colour; never colour an icon differently from its label except status icons (`success`, `warning`, `danger`).
- Direction icons (arrows, chevrons, undo, logout, external link) flip automatically in right-to-left; others never do.
- Pair icons with words. Icon-only controls are `IconButton`s with labels.
- No emoji in the interface, no icon fonts. The SVG files are also in Assets › Icons.
