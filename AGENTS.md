# Repository Guidelines

## Project Structure & Module Organization

The Morning Tab is a browser extension that generates a personalized new-tab page. This pnpm workspace contains:

- `apps/extension/`: WXT/React extension; `entrypoints/` holds the new-tab UI, background worker, and content scripts; `lib/` contains browser adapters; `public/icon/` holds icons.
- `packages/agent-core/`: host-independent TypeScript orchestration, prompts, schemas, history processing, and Social Pulse logic. Keep browser-specific operations behind adapters.
- `harness/`: Bun unit tests, fixtures, agent scripts, and browser verification tools.
- `docs/`: supporting plans and images. Consult `ARCHITECTURE.md` before changing cross-package behavior.

## Build, Test, and Development Commands

Use Node.js 20+ (CI uses 22), pnpm 10.11.1, and Bun for tests.

- `pnpm install --frozen-lockfile`: install locked workspace dependencies.
- `pnpm dev`: start WXT with hot reload.
- `pnpm build`: build the extension for Chromium.
- `pnpm typecheck`: check TypeScript across packages.
- `pnpm test`: run Bun unit tests without API calls.
- `pnpm extension:test`: test the built extension in headless Chrome.
- `pnpm extension:social-visual`: capture fixture-based Social Pulse screenshots using Chrome for Testing.

## Coding Style & Naming Conventions

Match existing TypeScript conventions: two-space indentation, double quotes, semicolons, and explicit types at module boundaries. Use PascalCase for React component files, `use`-prefixed camelCase hooks, and kebab-case utility modules. Import shared code through `@themorningtab/agent-core`. No dedicated formatter or lint script is configured; preserve surrounding style and run type checks.

## Testing Guidelines

Use `bun:test` and name unit tests `harness/*.test.ts`. Describe observable behavior in test names and reuse fixtures for deterministic tests. Cover parser failures, blocked sites, and privacy-sensitive behavior when relevant. No numeric coverage threshold is configured. Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before submitting; these are CI checks. Include browser verification for extension UI changes.

## Commit & Pull Request Guidelines

Follow the history's Conventional Commits, such as `fix(newtab): open homepage links in a new tab`. Use concise imperative subjects and relevant scopes. PRs should explain behavior changes, link relevant issues, list verification results, and include screenshots for UI changes. Review diffs before committing; push only when explicitly authorized.

## Security & Configuration

Never commit `.env`, credentials, or browsing data. Use `.env.example` for configuration names without secrets. Live agent runs call the real API and incur usage costs. Preserve blocked-site filtering and Social Pulse's opt-in behavior; never log keys or session cookies.
