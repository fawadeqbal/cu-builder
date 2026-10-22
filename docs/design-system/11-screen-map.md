# Screen map

Every screen in the product, the page template it uses (see Layout) and the components it is built from. Design screens from this list; each one ships in light and dark, LTR and RTL, at 360px and desktop.

## Start and account

| Screen | Route | Template | Built from |
| --- | --- | --- | --- |
| Landing and guest builder | `/` | Marketing → Workspace | `AppBar` (signed out), `Button`, `PaperSheet`, `TemplateCard`, `StepRail` |
| Sign in / Create account | `/sign-in`, `/sign-up` | Reading | `Logo`, `TextField`, `Button` (Google, LinkedIn, Microsoft as secondary), `Alert` |
| Forgot / reset password | `/forgot-password`, `/reset-password` | Reading | `TextField`, `Button`, `Alert` |
| Join an organisation | `/join/[code]` | Reading | `Avatar` (square), `Card`, `Button` |
| Account | `/account` | Settings | `SideNav`, `Card`, `TextField`, `Select`, `LanguageSwitcher`, `ThemeToggle`, `DataTable` (devices, extension keys) |
| Plan and billing | `/account/billing` | Settings | `Card`, `KeyValue`, `ProgressBar` (credits), `PricingCard`, `Button` |
| Pricing | `/pricing` | Marketing | `PricingCard`, `SegmentedControl` (monthly / yearly), `Badge` |

## CVs

| Screen | Route | Template | Built from |
| --- | --- | --- | --- |
| My CVs | `/app` | List | `PageHeader`, `Card` (CV with `PaperSheet` thumbnail), `Menu`, `FileDrop` (import), `EmptyState`, `Alert` (verify email) |
| Editor | `/edit/[id]` | Workspace | `SegmentedControl` (Edit / Split / Preview), `StepRail`, `ScoreRing`, `Card` panels, `TextField`, `TextArea`, `AiSuggestions`, `PaperSheet` on the canvas, `Toast` |
| ATS report | dialog | — | `Dialog`, `ScoreRing` (lg), `ProgressBar` per section, `Alert` per issue |
| Template gallery | `/templates` | Marketing | `Tabs` (tiers), `Chip` filters, `Switch` (ATS only), `ColorSwatches`, `TemplateCard`, `Dialog` (preview) |
| Share | dialog | — | `Dialog`, `TextField` (link), `Switch`, `StatTile`, link analytics chart |
| Public CV | `/r/[slug]` | Reading | `PaperSheet`, `Button` (Download PDF) |

## Job search

| Screen | Route | Template | Built from |
| --- | --- | --- | --- |
| Find jobs | `/jobs?tab=feed` | List | `Tabs`, `SearchField`, `Chip`, `JobCard`, `MatchScore`, `Dialog` (preferences and alerts) |
| Saved jobs | `/jobs?tab=saved` | List and detail | `Card` list, `KeywordList`, `MatchScore`, `Button` (match, tailor, letter) |
| Tailor review | dialog | — | `Dialog` (lg), diff list with `Checkbox`, `AiSuggestions` |
| Tracker board | `/tracker` | List and detail | `SegmentedControl`, `SearchField`, `BoardColumn`, `ApplicationCard`, `Drawer` |
| Tracker list / calendar / offers | `/tracker?view=…` | List | `DataTable`, `CalendarMonth`, offer comparison table, `Select` (negotiation template), `TextArea` |
| Application drawer | `/tracker?app=[id]` | Drawer | `Tabs`, `TextField`, `Select`, `TextArea`, `KeyValue`, `Timeline` (reminders), `Button` |
| Letters | `/letters`, `/letters/[id]` | List, Workspace | `Card`, `TextArea`, `AiSuggestions`, `PaperSheet` |
| Interview prep | `/interview` | Single column | `Tabs`, `Select`, `Card`, `ProgressBar`, `ScoreRing`, `TextArea`, `Button` (record), `AiSuggestions` |

## Services

| Screen | Route | Template | Built from |
| --- | --- | --- | --- |
| Expert directory | `/experts` | List | `Chip` filters, `ExpertCard`, `EmptyState` |
| Expert profile and booking | `/experts/[id]` | Single column | `Avatar` (lg), `Stars`, `Card` per service, `Dialog` (book: `Select`, `RadioGroup`, slot grid of `Chip`s) |
| My orders | `/orders` | List | `DataTable`, `Badge` (status) |
| Order | `/orders/[id]` | Single column | `PageHeader`, `Timeline`, `KeyValue`, messages, `Stars` (rate), `Dialog` |
| Expert workspace | `/expert` | Settings | `SideNav`, `Card`, `TextField`, availability rows, `DataTable` (queue) |
| CV review | `/review/[resumeId]` | Workspace | `PaperSheet`, line list, `ReviewComment`, `TextArea` |

## Organisations, sites, admin

| Screen | Route | Template | Built from |
| --- | --- | --- | --- |
| Organisations | `/org`, `/org/new` | List | `Card`, `RadioGroup` (type), `TextField` |
| University dashboard | `/org/[id]` | Settings | `SideNav`, `StatTile`, `DataTable`, `ScoreRing`, `Select` (cohort) |
| Members and invites | `/org/[id]?tab=members` | Settings | `DataTable`, `Dialog` (invite, CSV), `FileDrop` |
| Agency candidates | `/org/[id]?tab=candidates` | Settings | `FileDrop`, `DataTable`, `Badge`, `Drawer` (review fields), `PaperSheet` with brand |
| White label | `/org/[id]/branding` | Settings | `Breadcrumbs`, `TextField`, `ColorSwatches`, `Checkbox` (templates), domain setup `Card` |
| My website | `/website` | Workspace | `Card`, `TextField`, `SegmentedControl` (theme), `Switch` (published), live preview |
| Portfolio site | `/p/[slug]` | Reading | Its own themes, contact form with `TextField` and `Button` |
| Admin | `/admin` | Settings | `Tabs`, `StatTile`, `DataTable`, `Select`, `Pagination` |
