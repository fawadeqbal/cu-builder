# MatchScore

The match score shows how well a CV fits a job as a percent with a small meter: on job cards, the match dialog and the extension.

## The consumer provides

- `score` (0–100).

## Rules

- 70+ reads "strong" (`success`), 45–69 "partial" (`warning`), under 45 "weak" (neutral, never red: a low match is information, not failure).
- Always one click from the breakdown in `KeywordList`; the tooltip says which CV was used.
