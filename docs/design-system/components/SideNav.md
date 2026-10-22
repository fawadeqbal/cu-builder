# SideNav

Side navigation moves between the sub-pages of one area: Account, an Organisation, the Expert workspace, Admin.

## The consumer provides

- `groups` of `{ title?, items: [{ href, label, icon?, count?, current? }] }`, and a `label` for the landmark ("Account", "Organisation").

## Rules

- `side-nav-width` (248px) on the inline-start side from `bp-lg`; below that it collapses into `Tabs` at the top of the page.
- The current item sits on `surface-3` in bold `ink` with a 3px `brand` bar on its start edge and a `brand` icon; counts are mono and `ink-3`.
- One level only. If an area needs more depth, it gets its own page with a `BackLink`.
