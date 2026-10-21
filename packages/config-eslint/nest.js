import globals from "globals";
import tseslint from "typescript-eslint";
import { base } from "./base.js";

/** NestJS apps: Node globals; decorators and DI need classes with injected params. */
export const nest = tseslint.config(...base, {
  languageOptions: { globals: { ...globals.node } },
  rules: {
    "@typescript-eslint/consistent-type-imports": "off", // DI needs runtime imports for constructor types
    "@typescript-eslint/no-extraneous-class": "off",
    "no-console": "off",
  },
});

export default nest;
