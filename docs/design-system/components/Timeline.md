# Timeline

Timelines show the stages of something with a known path: an expert order, an import, a subscription.

## The consumer provides

- `items` (`{ title, meta?, state: "done" | "current" | "todo" }`); `meta` holds the time or who.

## Rules

- Done stages tick in `success`; the current one has a `brand` ring; future ones stay outlined and `ink-3`.
- Describe what happened in the past tense ("Paid", "Delivered") and what's next plainly ("Ayesha delivers by Friday").
