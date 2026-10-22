# CalendarMonth

The month calendar shows interviews, deadlines and reminders across a month in the tracker.

## The consumer provides

- `month` ("October 2026"), `days` (42 cells from Monday; each `{ date, out?, today?, events? }`, events with a `label` and `stage`).

## Rules

- Weeks start on Monday; in Arabic locales the week starts on Saturday and columns mirror.
- Events show time and a short name, coloured by stage on the inline-start edge; more than three per day collapse to "+2 more".
- Clicking an event opens its application; reminders have a checkbox to mark them done.
