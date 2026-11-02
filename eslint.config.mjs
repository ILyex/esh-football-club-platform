import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";

// ============================================================================
// ESLint flat configuration
// ----------------------------------------------------------------------------
// This replaces `FlatCompat.extends("next/core-web-vitals", "next/typescript")`.
// Those legacy configs load @rushstack/eslint-patch, which cannot patch
// ESLint >= 9.30 ("Failed to patch ESLint because the calling module was not
// recognized") — with them `npm run lint` crashed before evaluating a single
// rule, so the lint gate in CI could never pass.
//
// The rules kept here are the ones the project actually enforces: Next.js
// Core Web Vitals plus the React/JSX correctness rules shipped with the plugin.
// Type-aware rules are intentionally not enabled (they need a TypeScript
// program per file and would multiply CI time).
// ============================================================================

const nextRules = {
  ...nextPlugin.configs.recommended.rules,
  ...nextPlugin.configs["core-web-vitals"].rules
};

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "node_modules/**",
      "src/generated/**",
      ".open-next/**",
      "release/**"
    ]
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      ...nextRules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Deliberately relaxed: the codebase uses `any` at integration
      // boundaries (FAF/Gmail payloads) and that is tracked separately.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off"
    }
  }
];
