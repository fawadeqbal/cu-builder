# Select

Selects choose one option from a short, known list: page size, template, interview level, stage, country format.

## The consumer provides

- `label`, `options` (strings or `{ value, label }`), `defaultValue`, optional `hint` / `error`.

## Rules

- Up to about 12 options. Fewer than 5 visible options read faster as a `RadioGroup` or `SegmentedControl`; long or searchable lists need a combobox (search + menu).
- Option labels are nouns in sentence case ("Europass", "Gulf CV"), no trailing punctuation.
- Uses the native `<select>` so phones show their own picker; only the chevron is ours.
