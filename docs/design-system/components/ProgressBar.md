# ProgressBar

Progress bars show how far along something measurable is: seats used, credits left, an upload, a 10-question mock interview.

## The consumer provides

- `value`, `max`, `label`, optional `valueLabel` ("214 of 250 seats"), `tone` (`brand`, `success` when complete, `warning` near a limit, `highlight` for credits).

## Rules

- Always show the numbers, not only the bar.
- Indeterminate work (AI writing, parsing a file) uses a `Spinner` with a sentence instead.
