# ColorSwatches

Colour swatches pick one colour from a fixed palette: a template's accent colour, a portfolio site accent.

## The consumer provides

- `colors` (`{ value, name }`; names are spoken: "Blue", "Clay"), `defaultValue`, `label`.

## Rules

- A fixed, tested palette only (every swatch passes 4.5:1 for text on white paper); no free colour picker for CV accents.
- The selected swatch gets a 2px `ink` ring with a `surface` gap; the name shows on hover and is the accessible label.
