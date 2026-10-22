# Drawer

Drawers open a record's details beside the list it belongs to, so people can work through items without losing their place: an application, review comments, filters on phones.

## The consumer provides

- `title`, `description`, `children` (often `Tabs` and their panels), `footer` (secondary actions like Delete at the start, Archive at the end), `onClose`.

## Rules

- Slides in from the inline end, `drawer-width` (480px) wide, full height, `shadow-lg` over the `scrim`; full width on phones.
- The open record is in the URL (`?app=…`) so Back closes it and links share it.
- Fields save on blur; show "Saving…" then nothing. No Save button in a drawer.
