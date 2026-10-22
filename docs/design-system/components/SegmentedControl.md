# SegmentedControl

Segmented controls switch between 2–5 views or modes of the same thing: Edit / Split / Preview in the editor, Board / List / Calendar in the tracker, Light / Dark / System.

## The consumer provides

- `label` (accessible group name), `options` (`{ value, label, icon? }`), `defaultValue`.

## Rules

- The selected segment is a raised `surface` thumb with `shadow-sm` on the `surface-3` track.
- Switches views instantly; never use it to submit or for more than five options.
- Icon-only segments still carry text for screen readers (`cvb-sr`) and a tooltip.
