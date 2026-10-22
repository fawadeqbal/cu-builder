# Stars

Stars show an expert's rating, and let a customer rate a finished order from 1 to 5.

## The consumer provides

- `value`, `max` (5), `size`. Pass `onRate(n)` to make it an input (a radio group of star buttons); without it, it's a read-only image with an accessible label ("Rated 4.8 out of 5").

## Rules

- Filled stars are `gold`; empty ones `line-strong`. Always print the number beside read-only stars ("4.8 (36)").
- Ask for a rating only when the order is complete, in the same dialog as "Complete the order".
