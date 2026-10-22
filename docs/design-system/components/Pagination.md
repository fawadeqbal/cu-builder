# Pagination

Pagination moves through long server-side lists: admin users, cohort tables over 50 rows, order history.

## The consumer provides

- `page`, `pages`. Keep the page in the URL (`?page=3`).

## Rules

- Show first, last and the neighbours of the current page; collapse the rest to "…".
- Lists people scan top to bottom (jobs, CVs, applications) load more on scroll or with a "Show more" button instead.
