# Skeleton

Skeletons hold the shape of content that is loading, so the page doesn't jump when it arrives.

## The consumer provides

- `width`, `height`, `shape` (`line`, `circle`, `block`). Compose them in the layout of what's coming.

## Rules

- Use for loads expected over 300ms; under that, show nothing.
- Never more than one screen of skeletons; never for actions (use a button's `loading`).
