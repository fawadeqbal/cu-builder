# Patterns

## Forms

- Group fields into `Card`s with a title and one line of help; two columns from 520px (`cvb-field-row`), one below.
- Labels above fields; required fields marked with `*` when most are optional, "(optional)" when most are required.
- Editor and drawer fields save on blur with a quiet "Saving…" indicator; dialogs and sign-up forms submit with a primary button.
- Validate on blur and on submit; the error replaces the hint under the field and focus moves to the first invalid field.

## Saving and undo

- Autosave everywhere the person edits their own work (CVs, letters, applications). Show "Saved" with the time, or "Saved on this device" for guests.
- Reversible actions happen immediately with a `Toast` and Undo (applying an AI suggestion, moving a card, archiving).
- Irreversible actions confirm in a `Dialog` that names the thing and the consequence, with a `danger` button repeating the verb ("Delete application").

## Loading, empty and error

| State | Show |
| --- | --- |
| Loading under 300ms | Nothing |
| Loading a list or page | `Skeleton`s in the shape of the content |
| Working (AI, parsing, checking DNS) | `Spinner` and a sentence of what's happening |
| Nothing yet | `EmptyState` inviting the first action |
| No results | "No matches for 'react native'" with Clear filters |
| Error | What failed, why if known, and Retry; keep what the person entered |

## AI assistance

- Triggered by a ghost button with the sparkle icon next to the thing it helps with ("Write it for me", "Improve this line").
- Results arrive as choices in `AiSuggestions`; nothing is applied without a click, and every apply has Undo.
- Show the credit cost before and the balance after; when credits run out, show the credits gate, not an error.
- Facts the AI can't know become [placeholders] highlighted in `gold-soft`.

## Plan gates

- Locked features stay visible with a `TierBadge` and a lock icon; using them opens the upgrade dialog that says what the plan adds.
- Never block reading or exporting work the person already made.

## Sharing and privacy

- Share links show who opened them (views, time, referrer) only to the owner; viewers see no tracking UI.
- Contact details can be hidden per link or per agency client; hidden fields are removed from the sheet, not blurred.

## Tables and lists

- Search and filters sit above the list and live in the URL; show the count ("214 students").
- Lists people scan (jobs, CVs, applications) use cards; lists people compare (students, users, orders) use `DataTable`.
