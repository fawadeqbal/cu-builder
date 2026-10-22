# Shape, depth and motion

## Corners

Corners grow with the object: `radius-xs` 4 (keys, checkboxes), `radius-sm` 6 (badges, chips, tooltips), `radius-md` 8 (buttons, inputs, menu items), `radius-lg` 12 (cards, panels, menus, alerts), `radius-xl` 16 (dialogs, drawers, feature cards), `radius-full` (pills, avatars, switches, rings). The CV sheet keeps sharp 2px corners: it's paper.

## Borders and depth

The interface is flat. Separate things with a 1px `line` border; reserve shadows for what floats.

| Token | Use |
| --- | --- |
| `shadow-xs` | Resting cards on canvas when a border alone is too faint |
| `shadow-sm` | Primary buttons, the segmented thumb, hovered interactive cards |
| `shadow-md` | Menus, popovers, toasts, a dragged card |
| `shadow-lg` | Dialogs and drawers |
| `shadow-paper` | The CV sheet and its thumbnails |

No coloured side stripes on cards, no gradients, no glows.

## Focus

Every focusable element shows a 2px `focus` ring outside a 2px `surface` gap (`--focus-ring` in the stylesheet). Inputs show focus with a `brand` border and a 3px `brand-soft` halo. Never remove focus styles.

## Motion

| Variable | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120ms | Hover, press, colour changes |
| `--dur-base` | 200ms | Toggles, tabs, segmented thumb, menus opening |
| `--dur-slow` | 320ms | Drawers, dialogs, progress and score rings |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Almost everything |
| `--ease-emphasized` | cubic-bezier(0.3, 0, 0, 1.15) | A card landing in a new column |

Motion explains where things come from: drawers slide from the inline end, dialogs fade and rise 8px, toasts rise from the bottom. With `prefers-reduced-motion`, durations drop to zero and spinners slow down.
