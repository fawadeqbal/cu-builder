# AiSuggestions

AI suggestions present what the assistant wrote as options to pick from, never as silent edits: summaries, bullet rewrites, tailoring.

## The consumer provides

- `title` ("Pick a summary"), `options` (strings; anything in [brackets] is a placeholder the person must fill and is highlighted), `credits` ("1 credit · 41 left").

## Rules

- Every option is a choice with "Use this"; applying shows a toast with Undo.
- The assistant never invents facts: numbers not in the person's text become [placeholders] in `gold-soft`.
- Show the credit cost before the call and the balance after.
