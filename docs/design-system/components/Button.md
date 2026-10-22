# Button

Buttons start an action: save, continue, book, download. One **primary** (blue) button per view marks the thing the screen is for; everything else is **secondary**, **ghost** or **link**.

## Variants

| Variant | Use for | Example |
| --- | --- | --- |
| `primary` | The single next step in the view | "Continue to Summary", "Save to tracker", "Book" |
| `secondary` | Real alternatives beside the primary | "Preview", "Cover letter" |
| `ghost` | Toolbar actions, low-emphasis and "Back" | "Back", "Cancel", "Show comments" |
| `danger` | The confirm button of a destructive dialog only | "Delete application" |
| `highlight` | Gold, for upgrade and celebratory moments; never beside a primary | "Upgrade to Premium" |
| `link` | Inline actions inside text | "Resend email" |

## The consumer provides

- `children`: a verb-first label in sentence case, ideally under 4 words ("Download PDF", not "PDF Download" or "OK").
- `variant`, `size` (`sm` 32px in toolbars and table rows, `md` 40px default, `lg` 48px on auth and marketing), optional `icon` / `iconEnd` (icon names from `Icon`), `loading`, `disabled`, `block`, and `href` to render a link that looks like a button.

## Rules

- Never two primary buttons in one view. In dialogs the primary sits at the inline end of the footer, Cancel (ghost) before it.
- `loading` keeps the label and swaps the icon for a spinner; the button stays the same width and is `aria-busy`.
- Disabled buttons explain themselves nearby ("Add your name to continue"); prefer leaving the button on and showing what's missing after the click.
- Icons go before the label; `iconEnd` only for direction (`arrow-right`) or leaving the app (`external-link`). Direction icons flip in right-to-left automatically.
- Focus shows the 2px `focus` ring with a 2px `surface` gap; never remove it.
