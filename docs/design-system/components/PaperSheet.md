# PaperSheet

The paper sheet is the CV page: always white, A4 (210×297) or US Letter (216×279), with a soft paper shadow on the dotted preview canvas.

## The consumer provides

- `children` (the rendered CV template); without them it draws a placeholder sheet for thumbnails. `size` (`a4`, `letter`), `accent` (the template's accent for placeholders), `pageBreakAt` (percent) to show where page 2 starts, `maxWidth`. Wrap it in `PreviewCanvas` in the editor.

## Rules

- The sheet keeps `paper` (white) in dark theme: it is what prints. Text inside comes from the template, never from interface tokens.
- The page-break line is a dashed `danger` rule with a "Page 2" label, shown only on screen.
- Zoom scales the sheet, never reflows it; the preview, print and PDF share one layout.
