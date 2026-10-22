# SearchField

Search fields filter what's on the page as you type: applications, students, templates, experts.

## The consumer provides

- `placeholder` naming what's searched ("Search applications"), `label`, optional `shortcut` hint (`/`).

## Rules

- Filter as you type (debounce 150ms); show the result count near the list, and an empty state that offers to clear the search.
- Searching that calls a server (the job feed) uses a form with a Search button instead.
