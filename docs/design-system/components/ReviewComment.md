# ReviewComment

Review comments are an expert's or career-office reviewer's note on one line of a CV, with an optional rewrite the owner can apply in one click.

## The consumer provides

- `author`, `role` ("Expert", "Reviewer"), `quote` (the line as it was), `body`, `suggestion`, `time`, `resolved`, `owner` (shows the owner's actions).

## Rules

- The quoted line sits behind a 2px `gold` rule, like a highlighter in the margin.
- "Use suggestion" replaces the line and offers Undo; "Done" resolves. Resolved comments hide behind "Show done".
- Comments anchor to CV lines, not page positions, so they survive template changes.
