# Avatar

Avatars stand for a person: the signed-in user, an expert, a comment's author, a student in a cohort.

## The consumer provides

- `name` (always; used for initials and the accessible name), optional `src`, `size` (`sm` 24, `md` 32, `lg` 56), `shape` (`square` for organisations). `AvatarStack` shows a few people with a "+n".

## Rules

- Initials in `ink-2` on `surface-3` when there's no photo; never a generic silhouette.
- Organisation logos use the square shape so they never read as a person.
