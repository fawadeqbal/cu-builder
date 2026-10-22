# JobCard

Job cards show a posting in the job feed with its match to the person's CV and the one action that matters: save it to the tracker.

## The consumer provides

- `title`, `company`, `location`, `salary`, `posted`, `source` (always credited: "Remotive"), `score`, `remote`, `saved`, `description` (two lines, expandable).

## Rules

- "Save to tracker" is the primary action; once saved it becomes "In your tracker" linking to the application.
- "View posting" leaves the app (external-link icon, new tab).
- Never hide the source; job boards require attribution.
