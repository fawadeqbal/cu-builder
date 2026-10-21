# @cvb/templates

The CV templates (React, server-safe), their catalog and the print stylesheet.

- `CVDocument({ cv, template, accent })` renders any template; `--cv-accent` recolours it.
- `@cvb/templates/catalog`: `TEMPLATES`, `TIERS`, `STYLES`, `LAYOUTS`, `ACCENTS`, `templateMeta`, `templateTags` (no React; safe for the API).
- `@cvb/templates/styles.css`: the A4 sheet and every template's styles. Import once in the app.

Adding a template: see "Adding things" in the root `ARCHITECTURE.md`.
