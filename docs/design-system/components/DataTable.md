# DataTable

Data tables compare many records across the same columns: students in a cohort, admin users, candidates, orders.

## The consumer provides

- `columns` (`{ key, label, numeric?, render? }`), `rows`, a `caption` for screen readers.

## Rules

- The first column names the row (`body-strong`, links to the record). Numbers align to the inline end in `data` (mono, tabular).
- Overline column heads on `surface-2`; 1px `line` row rules; hover `surface-2`; selected `brand-soft`.
- Wrap tables in `cvb-table-wrap` so only the table scrolls sideways on phones; under `bp-sm` consider a card list instead.
- Sorting, filtering and pagination live above the table and in the URL.
