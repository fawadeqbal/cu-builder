# RadioGroup

Radio groups choose exactly one option from a small set where every option deserves a description: job alerts, session length, writing tone.

## The consumer provides

- `legend` (the question), `name`, `options` (`{ value, label, description? }`), `defaultValue`, `orientation` (`vertical` default; `horizontal` for 2–3 short labels).

## Rules

- Always pre-select the safest or most common option.
- If the options are icons or very short words and switch a view, use `SegmentedControl` instead.
