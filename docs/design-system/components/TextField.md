# TextField

Text fields collect one line of text: names, job titles, URLs, salaries, search terms.

## Anatomy

Label (with a red `*` when required, "(optional)" when the form is mostly required), the control, then **one** line below it: a hint in `ink-3`, or the error in `danger` with an alert icon. Errors replace hints, never stack under them.

## The consumer provides

- `label`, optional `hint`, `error`, `required` / `optional`, `placeholder` (an example, never instructions: "e.g. Senior Frontend Engineer").
- `prefix` / `suffix` for units and currencies ("PKR", "/ month"), `icon` for search-like fields, `size="sm"` in dense tables.
- Any native input props (`type`, `value`, `onChange`, `autoComplete`, `inputMode`).

## Rules

- Labels sit above the control, always visible; never use the placeholder as the label.
- Validate on blur and on submit, not on every keystroke. Write the fix, not the fault: "Add an email so employers can reach you", not "Invalid input".
- Group related fields in a `Card` and lay them out in `cvb-field-row` (two columns from 520px, one below).
- In right-to-left the prefix and suffix swap sides; URLs and emails keep `dir="ltr"` inside the input.
