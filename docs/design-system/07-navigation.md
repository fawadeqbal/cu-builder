# Navigation

People should always know where they are, how they got there and how to go back. Every screen has exactly one way up (its parent) and the browser's Back always does what people expect.

## The map

```
Signed out
  /                 Guest builder (make a CV without an account)
  /templates        Template gallery
  /pricing          Plans, passes, credits
  /experts          Expert directory  →  /experts/[id]  profile and booking
  /sign-in  /sign-up  /forgot-password  /reset-password
  /join/[code]      Join an organisation
  /r/[slug]  /l/[slug]  /p/[slug]   Public CV, letter, portfolio site

Signed in: app bar
  My CVs     /app                     →  /edit/[id]  editor (Edit · Split · Preview)
  Jobs       /jobs?tab=feed|saved     →  match, tailor, cover letter dialogs
  Tracker    /tracker?view=board|list|calendar|offers  →  ?app=[id] application drawer
  Interview  /interview?tab=practice|bank|stories
  Experts    /experts  →  /experts/[id]
  Letters    /letters  →  /letters/[id]

Signed in: account menu
  Account            /account  →  /account/billing
  Expert orders      /orders   →  /orders/[id]  →  /review/[resumeId] (expert)
  My website         /website
  Organisations      /org  →  /org/new  →  /org/[id]?tab=…  →  /org/[id]/branding
  Expert workspace   /expert
  Admin              /admin?tab=overview|users|templates|organisations|experts
```

## Global navigation

- The `AppBar` holds the six product areas in a fixed order. The current area is underlined in `brand`.
- Everything about the person (account, billing, orders, website, organisations, expert work, admin) lives in the account menu under the avatar.
- Signed-out pages show the mark, Templates, Experts, Pricing, Sign in and a primary "Build a CV".

## Local navigation

| Depth | Pattern | Example |
| --- | --- | --- |
| Sibling views of one thing | `SegmentedControl` | Tracker: Board / List / Calendar / Offers |
| Sibling sections of one page | `Tabs` | Jobs: Find jobs / Saved jobs |
| Sub-pages of an area | `SideNav` (Tabs under `bp-lg`) | Organisation: Students, Members, Settings |
| A record inside a list | `Drawer` with the id in the URL | `/tracker?app=…` |
| Second level | `BackLink` naming the parent | "← Orders" on `/orders/[id]` |
| Third level and deeper | `Breadcrumbs` | Organisations › Lahore School › White label |

## Back and forth

- **The URL is the state.** Tabs, views, filters, the open drawer and the page number live in the query string, so Back, refresh and shared links restore exactly what was on screen.
- **Back links go to the parent**, never `history.back()`: a link opened from an email still has a way out.
- **Closing restores context.** Closing a drawer or dialog returns focus to the element that opened it and keeps the scroll position.
- **Forward is the primary button.** Multi-step flows (the CV steps, booking, onboarding) name the next step on the button and allow going back without losing input.
- **Leaving with unsaved work** is rare because things save as you type; when it can happen, warn once before leaving.
- **After an action, land somewhere useful:** saving a feed job offers "Open in tracker"; creating a CV opens the editor; booking opens the order.
