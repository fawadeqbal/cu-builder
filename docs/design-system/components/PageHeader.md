# PageHeader

The page header opens every page: the way back (a `BackLink` or `Breadcrumbs`), an optional eyebrow, the `heading-1` title, one line of description, and the page's actions.

## The consumer provides

- `title` (a noun naming what's on the page: "Applications", "Sara's website"), optional `back` (`{ href, label }`: the parent page's name, "Organisations"), or `breadcrumbs`, `eyebrow` ("Step 3 of 8", "University"), `description` (one sentence, `ink-3`), `actions` (at most one primary).

## Rules

- One per page, under the `AppBar`, starting `space-10` from it.
- The back link always names its destination ("← Orders"), never "Back"; it goes to the logical parent, not `history.back()`, so a shared link still has a way out.
- Actions wrap under the title on narrow screens.
