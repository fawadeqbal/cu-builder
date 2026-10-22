# Theming and white label

## Light and dark

- Two themes, Light and Dark, plus System (the default) which follows the device. The choice is stored in a cookie and applied on the server as `data-theme` on `<html>`, so pages never flash.
- Components only read tokens, so they theme for free. Never write a colour that exists in one theme only.
- Dark is not inverted light: surfaces step up in lightness (`canvas` → `surface` → `surface-2`), the brand turns light blue with dark `on-brand` text, and soft status grounds become deep tints.
- The CV sheet stays white (`paper`) in dark theme, framed by the canvas.

## White label (partners)

Universities, career centres and job boards can run CV Builder under their own brand. A partner sets, per organisation:

| Setting | Effect |
| --- | --- |
| Product name | Replaces "CV Builder" in the app bar, page titles and emails |
| Logo | Replaces the mark and wordmark in the app bar and on agency-formatted CVs (`brand` prop of the CV document) |
| Primary colour | Overrides `brand`, `brand-hover`, `brand-pressed`, `brand-soft`, `brand-ink`, `on-brand` (the platform derives the set and rejects colours under 4.5:1 with white or dark text) |
| Accent colour | Overrides `gold` and `gold-soft` |
| Templates offered | Limits the template gallery to a subset |
| Hide "Made with CV Builder" | Removes the footer credit |
| Custom domain | Serves the branded app on the partner's domain |

Partners never change neutrals, status colours, type, spacing or components: the product stays usable and accessible under any brand.
