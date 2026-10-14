# Changelog

All notable changes to The Morning Tab are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-14

### Added

- Forked from [ThariqS/ai-newtab](https://github.com/ThariqS/ai-newtab) at
  upstream commit `5c8d0b11c3aa5d2eab91dbc48e434233f59faa2b`, with the full
  upstream history kept.
- `CREDITS.md`, crediting Thariq and describing what originated upstream.
- `CHANGELOG.md`.
- A CI workflow that runs typecheck, unit tests and the extension build.

### Changed

- Rebranded from "AI Homepage" to **The Morning Tab**: extension name, short
  name and description, new-tab title, setup, progress and settings views, and
  the failed-build notification.
- Workspace packages moved from the `@homepage` scope to `@themorningtab`.
- README rewritten for The Morning Tab. Upstream's technical content is kept.
- `LICENSE` gains a second copyright line for Mejba Ahmed. The original MIT
  text and Thariq Shihipar's copyright line are unchanged.

### Unchanged

- Agent logic, tool names (`getHistory`, `getPageHtml`), the privacy blocklist,
  sandbox settings and the security model are the same as upstream.

[0.1.0]: https://github.com/mejba13/themorningtab/releases/tag/v0.1.0
