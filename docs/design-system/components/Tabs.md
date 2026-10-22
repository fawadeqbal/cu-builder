# Tabs

Tabs switch between sibling panels on one page: Find jobs / Saved jobs, Details / Contacts / Research / Offer / Share in the application drawer.

## The consumer provides

- `items` (`{ id, label, count?, icon? }`), `defaultValue`, `label`. Put the tab id in the URL (`?tab=saved`) so the browser's Back button and shared links return to the same tab.

## Rules

- 2–6 tabs, labels of one or two words. More than six means the page should be split.
- The selected tab has `ink` text and a 2px `brand` underline on the 1px `line` rule; counts sit in a small pill.
- Arrow keys move between tabs; Tab moves into the panel.
- Use `SegmentedControl` instead when the options are views of the same data (Board / List).
