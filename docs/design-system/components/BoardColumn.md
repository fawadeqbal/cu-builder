# BoardColumn

Board columns are the stages of the application tracker: Saved, Applied, Interview, Offer, Rejected, or the person's own.

## The consumer provides

- `title`, `stage` (sets the dot colour from `stage-*` tokens), `count`, `over` while a card is dragged over it, and `ApplicationCard` children sorted by position.

## Rules

- 272px wide on `surface-2` with a `line` border; the board scrolls sideways inside its container, never the page.
- While dragging, the target column turns `brand-soft` and a 2px `brand` line marks where the card will land.
- Every move also works without a mouse: each card has a "Move to" control and arrow-key support.
