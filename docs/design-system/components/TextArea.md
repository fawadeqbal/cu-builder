# TextArea

Text areas hold multi-line writing: the CV summary, notes on an application, interview answers, messages to an expert.

## The consumer provides

- `label`, `hint` or `error`, `rows` (4 by default; 7 for interview answers), `placeholder`.
- `max` shows a live counter at the inline end ("51/600") when there is a real limit.

## Rules

- Let it grow with `resize: vertical`; never fix the height of writing areas.
- AI help for a text area appears beside its label as a ghost `Button` with the sparkle icon ("Write it for me"), and results open in `AiSuggestions`, never overwriting what the person typed without a choice and an Undo.
- Keep the counter quiet (`ink-3`); turn it `warning` only within 10% of the limit.
