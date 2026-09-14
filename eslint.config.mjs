import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
import next from "@next/eslint-plugin-next";
import globals from "globals";
import ts from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.cache/**",
    "artifacts/**",
    "resources/**",
    "native/build/**",
    "native/.build/**",
    "src-tauri/target/**",
    "src-tauri/gen/**",
    "graphify-out/**",
    "website/public/**",
    "website/.next/**",
    "website/out/**",
    "website/next-env.d.ts",
    "marketing/product-hunt/assets/**",
  ]),
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    linterOptions: { reportUnusedDisableDirectives: "error", reportUnusedInlineConfigs: "error" },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./**", "../**"],
              message: "Use @/ imports relative to the repository root.",
            },
          ],
        },
      ],
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-var": "error",
      "prefer-const": "error",
      "no-throw-literal": "error",
      "no-eval": "error",
      "no-implicit-coercion": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [ts.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        { allowForKnownSafeCalls: [{ from: "package", name: "test", package: "node:test" }] },
      ],
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "website/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["src/**/*.{ts,tsx}", "website/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" },
  },
  {
    files: ["src/**/*.tsx", "website/**/*.tsx"],
    extends: [a11y.flatConfigs.recommended],
  },
  {
    files: ["website/**/*.{ts,tsx}"],
    plugins: { "@next/next": next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  prettier,
);
