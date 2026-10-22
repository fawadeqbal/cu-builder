# Type

Three families with clear jobs, plus two for right-to-left scripts.

| Family token | Face | Use |
| --- | --- | --- |
| `display` | Schibsted Grotesk (400–900) | Page and section titles, big numbers, prices, the wordmark. |
| `sans` | Instrument Sans (400–700) | Everything else: body, labels, buttons, tables. |
| `mono` | IBM Plex Mono (400, 500) | Figures in tables, IDs, keyboard keys, keywords, counters. |
| `arabic` | IBM Plex Sans Arabic | Arabic interface and CVs. |
| `urdu` | Noto Nastaliq Urdu | Urdu interface and CVs. |

## Scale

Display: `display-xl` 52/56 (marketing heroes), `display-l` 38/44, `heading-1` 28/34 (page title, once per page), `heading-2` 21/28 (sections, dialog titles), `heading-3` 17/24 (cards, panels), `metric` 32/36 (stat tiles).

Text: `body-l` 16/26 (reading: letters, bios, help), `body` 14/22 (the default), `body-strong`, `label` 13/18, `button` 14/20, `caption` 12/16, `overline` 11/14 uppercase with 0.08em tracking.

Data: `data` 13/18 and `kbd` 12/16 in mono with tabular figures.

## Rules

- One `heading-1` per page. Don't skip levels for size; pick the style that matches the hierarchy.
- Titles use `text-wrap: balance`; running text stays under about 70 characters a line.
- Figures that line up (tables, prices, scores, counters) use tabular numerals or `mono`.
- Uppercase overlines only in Latin scripts; in Urdu and Arabic use the same size in normal case without tracking.
- Urdu Nastaliq needs about twice the line height of Latin text (`body-ur` 15/32, `heading-ur` 22/44); never clip its descenders with fixed heights.
- CV templates have their own type; the interface type never appears on the sheet.
