# Breadcrumbs

Breadcrumbs show where a page sits in a hierarchy deeper than two levels, and let people jump up: Organisations › Lahore School of Tech › White label.

## The consumer provides

- `items` (`{ href?, label }`); the last item is the current page and has no link.

## Rules

- Only for pages three or more levels deep. Two levels use a `BackLink`. Never both on one page.
- Truncate middle items to "…" on phones; keep the first and the last two.
- Chevrons point in the reading direction and flip in right-to-left.
