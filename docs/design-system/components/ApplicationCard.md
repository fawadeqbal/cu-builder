# ApplicationCard

Application cards are one job application on the tracker board: title, company, place, and the few facts that need attention.

## The consumer provides

- `title`, `company`, `location`, and only what applies: `interview` (date), `deadline`, `views` (CV link views), `offer`; `dragging` while lifted.

## Rules

- Two lines of title at most; badges only for upcoming dates, offers and views. Everything else lives in the drawer.
- The whole card opens the application `Drawer`; dragging lifts it with `shadow-md` and a slight tilt.
