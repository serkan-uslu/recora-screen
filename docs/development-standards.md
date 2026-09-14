# Code quality

Use `npm ci` (Node 22.12 or newer). This installs the Husky pre-commit hook. Do not bypass the hook to land failing code.

| Command                           | Purpose                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run check`                   | Zero-warning ESLint, strict TypeScript, Node unit tests, site tests, Prettier check, and Knip |
| `npm run lint:fix`                | Apply safe ESLint fixes                                                                       |
| `npm run format`                  | Format maintained sources and documentation                                                   |
| `npm run build`                   | All checks, then application UI and Node service bundles                                      |
| `npm run build:site`              | Build the static product website                                                              |
| `npx playwright install chromium` | Install the browser used by the E2E suite                                                     |
| `npm run test:e2e`                | Test the site with desktop and mobile viewports on isolated port 4184                         |
| `npm run test:native`             | Native Swift regression checks on macOS                                                       |
| `npm run desktop:check`           | Compile/check the Tauri integration on macOS                                                  |

ESLint uses flat configuration, TypeScript-aware promise checks, unused-code detection, React Hook rules and JSX accessibility rules. All warnings fail the check. Prettier runs separately using `eslint-config-prettier`; it cannot conflict with stylistic lint rules. `.editorconfig` supplies editor-independent whitespace defaults.

The pre-commit hook runs ESLint and Prettier on staged source files. It does not replace the complete check or CI. lint-staged protects partially staged changes with its normal stash behavior. Install hooks with `npm run prepare` if a checkout disabled install scripts.

The existing Node test runner covers services, timelines, playback controllers and MCP. Vitest is not installed as a redundant second unit runner. Playwright covers browser interactions; it does not replace actual macOS capture/preview testing.

Knip includes the native-launched Node entry point, the socket compatibility entry point and command-line acceptance scripts explicitly. The Tauri CLI is launched by the desktop wrapper; `rustc`, `cmake`, `ffmpeg` and `ffprobe` are external native build tools, so these are named exceptions in Knip.

ESLint 9 is pinned because the current `eslint-plugin-jsx-a11y` peer range does not yet support ESLint 10. ESLint 9 is deprecated upstream; upgrade both together when the accessibility plugin supports 10, and recheck the minimum Node version. Do not force incompatible peer dependencies.

A few legacy heterogeneous RPC signatures retain documented line-local `no-explicit-any` exceptions. Requests still pass through the shared Zod command validation. Domain code and new features must use concrete types; these exceptions do not mean the entire transport is statically type-safe.

Generated builds, vendored assets, and hashed launch evidence are excluded from formatting and linting so quality tooling does not invalidate recorded checksums.

## Imports

`@/` resolves TypeScript and JavaScript modules from the repository root: `@/shared/types`, `@/server/contracts/validation.js`, and `@/src/components/atoms/IconButton`. TypeScript paths configure type checking, tsx, and esbuild; both Vite configurations use the same root. ESLint rejects relative module imports. CSS `@import` and filesystem resource paths retain relative paths because they are resolved by their own loaders. Bundled Node services resolve aliases at build time, so installed apps need no alias loader.

The website Vite CLI uses the installed `tsx` loader with `--configLoader native`, so aliases also work while loading its configuration, before Vite initializes its own resolver.
