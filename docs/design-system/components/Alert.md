# Alert

Alerts tell people something about the page they are on and, when possible, what to do: a plan limit, a tip, a failed import, an unverified email.

## The consumer provides

- `tone` (`info`, `success`, `warning`, `danger`, `highlight`), optional `title` (bold, the fact), `children` (one or two sentences: why and what to do), `actions` (buttons), `onDismiss`, `banner` (full-width, square, under the app bar).

## Rules

- One alert per region. Inline alerts sit above the content they're about; banners are for the whole account (email unverified, payment failed).
- Write the fix: "Add at least 3 skills so recruiters can find you", with the button that does it.
- `danger` alerts use `role="alert"`; others `role="status"`.
- Editor tips use `info` with the lightbulb icon; `highlight` is reserved for good news and offers.
