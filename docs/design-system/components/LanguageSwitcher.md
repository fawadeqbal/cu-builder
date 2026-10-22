# LanguageSwitcher

The language switcher changes the interface language between English, اردو and العربية; Urdu and Arabic switch the whole layout to right-to-left.

## The consumer provides

- `defaultValue`. Save the choice to a cookie (server-rendered `lang` and `dir` with no flash) and to the account when signed in.

## Rules

- Each language is written in itself ("اردو", not "Urdu") and tagged with `lang` so it renders in the right font.
- Changing the interface language never changes a CV's language or direction; that is a CV setting.
