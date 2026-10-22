# Dialog

Dialogs ask for a decision or a short task without leaving the page: confirm a delete, add a job, book an expert, review AI tailoring.

## The consumer provides

- `title` (the task as a phrase: "Add an application", or the question: "Delete this application?"), optional `description`, `children` (the form or content), `footer` (Cancel as ghost, then one primary at the inline end), `size` (`sm` confirms, `md` default, `lg` previews and booking), `onClose`.

## Rules

- Escape and the close button always close; a click on the scrim closes unless the dialog has unsaved input.
- Focus moves to the first field (or the safest button) on open and returns to the trigger on close.
- Destructive confirms name the thing and the consequence: "Delete this application? The saved job stays in Jobs." with a `danger` button "Delete application". Prefer Undo in a toast where the action can be reversed.
- On phones dialogs rise from the bottom as a sheet with `radius-xl` top corners.
