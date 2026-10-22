# Layout and spacing

## Spacing

A 4px scale: `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-5` 20, `space-6` 24, `space-8` 32, `space-10` 40, `space-12` 48, `space-16` 64, `space-20` 80 (plus `space-0_5` and `space-1_5` for nudges).

- Lay out siblings with `gap`, not margins.
- Inside cards and dialogs: `space-5` padding, `space-3` between items, `space-4` between fields.
- Between cards in a grid: `space-6` (`space-4` on phones). Between page sections: `space-8`.
- Page gutter: `space-4` on phones, `space-6` from `bp-md`. Content starts `space-10` below the app bar.

## Page widths

In code the widths are `--layout-sm|md|lg|xl` (Tailwind: `max-w-(--layout-lg)`), because Tailwind owns `--container-*`.

| Width | Token | Screens |
| --- | --- | --- |
| 640 | `container-sm` | Sign in, onboarding, account settings forms, join pages |
| 960 | `container-md` | Letters, interview practice, order pages, website editor |
| 1200 | `container-lg` | My CVs, jobs, experts, organisations, pricing |
| 1440 | `container-xl` | Editor workspace, tracker board, admin tables |

## Breakpoints

Mobile first: `bp-sm` 640, `bp-md` 768, `bp-lg` 1024, `bp-xl` 1280, `bp-2xl` 1536.

- Under `bp-md`: one column; dialogs become bottom sheets; drawers go full width; tabs and the board scroll sideways inside themselves.
- From `bp-lg`: side navigation shows; the editor offers Split view.
- From `bp-xl`: three- and four-column grids.

## Page templates

1. **Workspace** (editor): app bar, step rail on the inline-start side, form in the middle, preview canvas on the inline-end side, resizable.
2. **List and detail** (tracker, jobs, letters): page header, filters, the list or board; details open in a `Drawer` or a side panel.
3. **Settings** (account, organisation, expert workspace, admin): page header, `SideNav` on the inline-start side, stacked `Card`s.
4. **Reading** (auth, join, public CV, public letter, portfolio): centred narrow column, no app bar for signed-out people.
5. **Marketing** (landing, pricing, templates gallery): wide bands with `space-16` rhythm, `display-*` type.
