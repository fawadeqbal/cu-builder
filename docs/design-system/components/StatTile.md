# StatTile

Stat tiles headline one number and what it means: views, applications, average ATS score, seats used.

## The consumer provides

- `label` (overline, what's counted), `value` (formatted, tabular), optional `delta` (`{ value, dir }`) and `hint` (the period or comparison: "this week", "of 250 seats").

## Rules

- Use them only when the numbers are the point of the screen (cohort dashboard, link analytics, admin). A row of 2–4 in `cvb-stat-grid`.
- Every number says its period or base in the hint. No vanity numbers.
