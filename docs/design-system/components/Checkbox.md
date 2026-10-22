# Checkbox

Checkboxes turn independent options on or off, or select rows: "Remote only", "Email me when it's opened", "Show archived".

## The consumer provides

- `label` (what becomes true when checked), optional `description` underneath, `defaultChecked`, `indeterminate` for "some selected" in table heads, `disabled`.

## Rules

- Phrase labels positively: "Show archived", not "Hide archived".
- An action that takes effect immediately and reads like a setting ("Weekly email", "Published") is a `Switch`; a choice submitted with a form is a checkbox.
- The check mark draws in `on-brand` on a `brand` fill; the box border is `line-control` (3:1).
