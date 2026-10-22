import { buttonClass } from "@cvb/ui";

/**
 * Class strings for plain elements that must look like design-system controls. Prefer the
 * components from @cvb/ui (<Button>, <TextField>, <Card>); use these when an element can't be one
 * (a <label> acting as a file button, a <Link>, a native input inside custom markup).
 */
export const btn = {
  primary: buttonClass({ variant: "primary" }),
  secondary: buttonClass({ variant: "secondary" }),
  ghost: buttonClass({ variant: "ghost" }),
  danger: buttonClass({ variant: "danger" }),
  highlight: buttonClass({ variant: "highlight" }),
  link: buttonClass({ variant: "link" }),
  /** Kept for old call sites: the dark button is now the primary (brand) button. */
  dark: buttonClass({ variant: "primary" }),
  sm: {
    primary: buttonClass({ variant: "primary", size: "sm" }),
    secondary: buttonClass({ variant: "secondary", size: "sm" }),
    ghost: buttonClass({ variant: "ghost", size: "sm" }),
    danger: buttonClass({ variant: "danger", size: "sm" }),
  },
};

/** A bare input, select or textarea styled as a design-system control. */
export const field = "cvb-input";

export const label = "cvb-label mb-1.5 block";

export const card = "cvb-card";
