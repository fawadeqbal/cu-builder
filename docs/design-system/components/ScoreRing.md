# ScoreRing

Score rings show a 0–100 score at a glance: CV strength, ATS score, a student's best score.

## The consumer provides

- `value`, `size` (`sm` 40 in tables, `md` 64 in panels, `lg` 112 in the ATS report), `label` (accessible: "ATS score 82 out of 100"), optional `tone`.

## Rules

- Default tones by value: under 50 `warning`, 50–79 `brand`, 80+ `success`.
- A score is always one click from its explanation: what counted and how to raise it.
