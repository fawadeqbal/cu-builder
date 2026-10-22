# Card

Cards group related content and controls into one object: a form panel, a section of a settings page, a summary with actions.

## The consumer provides

- Optional `title` (`heading-3`) and `description`, `actions` in the head (ghost buttons or a `Menu`), `children` for the body, `footer` for the form's buttons; `interactive` when the whole card opens something; `selected`.

## Rules

- `surface` with a 1px `line` border and `radius-lg`; no shadow at rest. Interactive cards gain `line-strong` and `shadow-sm` on hover.
- Body padding `space-5`, gap `space-3`; fields inside use `cvb-field-row`.
- Don't nest cards. Inside a card, separate groups with a `cvb-divider` or a `heading-3`.
- No coloured side stripes; status goes in a `Badge`.
