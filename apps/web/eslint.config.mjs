import { next as shared } from "@cvb/eslint-config/next";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...shared,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
