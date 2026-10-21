import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/**
 * Rules every package shares. Module boundaries are enforced with
 * `no-restricted-imports`: apps may not reach into another package's internals.
 */
export const base = tseslint.config(
  { ignores: ["dist/**", ".next/**", "out/**", "coverage/**", "src/generated/**", "**/*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@cvb/*/src/*", "@cvb/*/dist/*"], message: "Import from the package entry point, not its internals." },
          ],
        },
      ],
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  prettier,
);

export default base;
