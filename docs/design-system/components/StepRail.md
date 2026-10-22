# StepRail

The step rail walks people through building a CV: eight steps, each with what it holds, done steps ticked and the current one highlighted.

## The consumer provides

- `steps`: `{ label, meta, icon, status: "done" | "current" | "todo" }`. `meta` is a fact about the step's content ("4 jobs", "51 words", "2 required left"), never a judgement.

## Rules

- Steps are links: any step can be opened at any time; progress never locks.
- The connector turns `success` below a done step. The current row is `brand-soft` with a `brand` bullet.
- From `bp-lg` the rail is 248px with labels; between `bp-md` and `bp-lg` it collapses to `rail-width` (icons only, labels as tooltips); below `bp-md` it becomes a select-style stepper with a progress bar.
- The CV strength `ScoreRing` sits at the top of the rail.
