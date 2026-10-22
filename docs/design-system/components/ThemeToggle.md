# ThemeToggle

The theme toggle chooses Light, Dark or System (the default, following the device).

## The consumer provides

- `defaultValue`. Store the choice in a cookie so the server renders the right theme with no flash, and set `data-theme` on `<html>`; System sets nothing and lets `prefers-color-scheme` decide.

## Rules

- Lives in the account menu and in Account › Appearance; on wide screens it may sit in the app bar.
- The CV sheet stays white (`paper`) in every theme.
