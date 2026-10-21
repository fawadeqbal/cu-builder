import { base } from "./base.js";

/**
 * Next.js apps add `eslint-config-next` in their own eslint.config.mjs (it must resolve
 * from the app). This preset carries the shared TypeScript rules.
 */
export const next = [...base];

export default next;
