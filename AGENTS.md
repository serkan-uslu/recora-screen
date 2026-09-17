# Development standards

## Required checks

After modifying code, run `npm run check` and resolve every failure before considering the task complete. Run `npm run build` for application changes and `npm run build:site` for website changes. Run `npm run test:e2e` for website interactions. Native changes additionally require `npm run test:native` and `npm run desktop:check` on macOS. Report unavailable checks accurately; never label them passed.

## TypeScript and lint

- Use `@/` imports relative to the repository root (for example, `@/shared/types` or `@/src/components/atoms/IconButton`). Relative module imports are rejected by ESLint. Keep filesystem paths and `new URL(..., import.meta.url)` resource lookups relative where required.
- Keep TypeScript strict mode enabled. Prefer existing domain types and validate unknown external data with the existing Zod schemas.
- Do not introduce `any`, `@ts-ignore`, unsafe assertions, or blanket lint suppressions. A small number of existing dynamic RPC dispatch signatures have documented, line-local exceptions; do not spread these into domain or UI code.
- Fix lint errors instead of weakening rules. Any unavoidable exception must be narrow and explain its boundary and reason.
- Handle promise rejections. `void` is appropriate only when the invoked operation handles its own errors or deliberately reports failures elsewhere.
- Keep Hook dependencies complete. Use the existing `useStableCallback` for gesture/event listeners that need current state without resubscribing; do not recreate the player to satisfy lint.
- Prettier owns formatting; ESLint owns correctness. Run `npm run format` after edits. Generated files, vendored media, and hashed launch evidence are excluded intentionally.

## Architecture and tests

- Reuse existing helpers. Keep business logic in services/controllers and small UI components focused on presentation.
- Remove unused imports, exports, dependencies and commented-out code. Do not add speculative abstractions.
- Add or update a focused regression test for changed business logic and reproducible bugs. Existing unit tests use Node's test runner; do not migrate them to another framework without a concrete need.
- Use Playwright for browser interactions. Browser tests do not establish native capture, permissions, or AVPlayer correctness; retain the desktop/native acceptance checks.
- Never use real user projects or personal recordings as disposable test fixtures.

## Repository knowledge graph

Follow the parent repository's Graphify guidance: query the local graph first when investigating code relationships and run `graphify update .` after code changes. Keep generated `graphify-out/` files local; never commit them.

## Release workflow

- Do not create a tag, GitHub Release or public asset without explicit user authorization. Do not commit or push unless the user asks.
- For version `X.Y.Z`, keep `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `release/X.Y.Z.json` aligned. Update the versioned download URL in `shared/brand.ts`, `vercel.json`, `.github/workflows/checks.yml`, the README and site copy.
- After all required checks pass and the user pushes, run the **Signed macOS release candidate** workflow for that commit. Download its artifact and verify the SHA-256, Developer ID signature, stapling and Gatekeeper acceptance.
- With explicit user approval, create tag `vX.Y.Z`, publish the GitHub Release with the exact notarized DMG, confirm the public asset URL returns HTTP 200, then redeploy the site.
