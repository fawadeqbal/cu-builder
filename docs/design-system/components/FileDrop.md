# FileDrop

File drops take files by drag and drop or a file picker: CV import (PDF, Word), agency bulk uploads, profile photos.

## The consumer provides

- `title`, `hint` (types and size limit), `state` (`idle` / `over` while dragging), and the `files` list with name, size and a status node (a `Badge`, a `Spinner`, a remove `IconButton`).

## Rules

- Say what happens next in the hint ("We read it and fill in your CV; you check it after").
- Check the type from the file's first bytes on the server, not only the extension; show per-file errors in the list, not a single alert.
- The whole area is a target, the button is the keyboard path.
