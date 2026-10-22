# Switch

Switches turn a setting on or off immediately, with no Save button: "Weekly email", "Published", "Link is on", "ATS-friendly only".

## The consumer provides

- `label`, `defaultChecked`, `onChange(on)`. Persist the change straight away and confirm in a toast only when it has consequences ("Your website is live").

## Rules

- Never inside a form that has a submit button; use a `Checkbox` there.
- The label states the setting, not the action ("Published", not "Publish").
- `role="switch"` with `aria-checked`; Space toggles it.
