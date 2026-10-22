# Menu

Menus list actions or choices that don't fit on screen: the account menu, a CV's "More" menu, the template switcher.

## The consumer provides

- `items`: `{ label, icon?, shortcut?, danger?, checked? }`, `"separator"`, or `{ heading }`; a `label` for the menu.

## Rules

- Opens from an `IconButton` ("More") or a `Button` with a chevron; aligns to the trigger's inline end; `shadow-md`, `radius-lg`.
- Arrow keys move, Enter acts, Escape closes and returns focus. Typing a letter jumps to the item.
- Destructive items come last, after a separator, in `danger`.
