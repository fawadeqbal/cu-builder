# TemplateCard

Template cards present a CV template in the gallery: a live A4 thumbnail, the name, its tier and who it's best for.

## The consumer provides

- `name`, `tier`, `bestFor` (roles or situations, never people), `accent`, `current` (the template in use: "In use" badge and a `brand` ring), `ats`.

## Rules

- Thumbnails render the person's own CV, not lorem ipsum; locked tiers still preview, with a `TierBadge` and an upgrade prompt on use.
- On hover show "Preview" and a primary "Use template"; keyboard users get the same on focus.
- Grid of 2 (phones) to 4 (from `bp-xl`) columns with `space-6` gaps.
