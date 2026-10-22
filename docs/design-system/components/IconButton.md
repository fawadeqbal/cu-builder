# IconButton

Icon buttons are square buttons with only an icon, for compact, repeated actions: close, more, move up, delete a row.

## The consumer provides

- `icon` (an `Icon` name) and `label`: the label is required. It becomes the accessible name and the tooltip ("Delete job", "More actions"), so screen readers and new users get the same words.
- `variant`: `ghost` (default, toolbars and rows), `secondary` (on canvas, next to secondary buttons), `primary` (rare: a floating add button).
- `size`: `sm` 32px inside rows and cards, `md` 40px in bars.

## Rules

- Use only icons whose meaning is common (close, more, trash, edit, chevrons). For anything else use a `Button` with a label.
- On touch screens pad the hit area to `touch-min` (44px) with surrounding spacing.
- Destructive icon buttons (trash) open a confirmation dialog or offer Undo in a toast.
