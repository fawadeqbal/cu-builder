# Toast

Toasts confirm that something happened and offer the one undo: "Summary updated · Undo", "Moved to Interview".

## The consumer provides

- `children` (the fact, past tense, under 60 characters), optional `action` (`{ label, onClick }`, usually Undo), `tone` (`success` for completed saves).

## Rules

- Bottom of the screen, centred on phones and at the inline end on desktop, above everything (`z-toast`); one at a time.
- 5 seconds, or 8 with an action; pause while hovered or focused. Never put errors that need a decision in a toast.
- Inverted colours (`ink` ground, `surface` text) so they read over any page in both themes.
