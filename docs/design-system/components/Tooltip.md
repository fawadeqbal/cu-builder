# Tooltip

Tooltips name an icon-only control or explain a term on hover and focus.

## The consumer provides

- `content` (a few words), `children` (the trigger, focusable).

## Rules

- Never hold anything essential or interactive; a tooltip that needs a link is a popover.
- `IconButton` adds its own tooltip from its label.
