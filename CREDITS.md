# Credits

**The Morning Tab is an extended version of [ai-newtab](https://github.com/ThariqS/ai-newtab), created by Thariq.**

- Thariq on GitHub: [@ThariqS](https://github.com/ThariqS)
- Thariq on X: [@trq212](https://x.com/trq212)
- Original repository: <https://github.com/ThariqS/ai-newtab>

ai-newtab is MIT licensed. The original copyright notice is kept, unchanged, in
[LICENSE](./LICENSE). The full upstream commit history is kept in this
repository, so every upstream contribution stays visible in `git log`.

## What originated upstream

The core of this project was designed and built upstream. That includes:

- **The agent architecture.** The host-agnostic agent loop in
  `packages/agent-core`: the orchestrator, session lifecycle, tool dispatch,
  resume and cleanup, the system prompt, the history digest and the site filter.
- **The Managed Agents flow.** Driving a Claude Managed Agents session straight
  from the extension's background worker with no server in between: the
  `getHistory` and `getPageHtml` custom tools, mounting scraped pages into the
  session sandbox, and reading the written homepage back out.
- **The extension foundation.** The MV3 extension built on WXT and React: the
  service worker build host, keepalive and reattach, the scraper, the new-tab
  UI, the sandboxed preview, settings, the privacy blocklist and scheduled
  rebuilds.
- **The harness and the documentation.** The Bun scripts that run the agent
  outside Chrome and test the built extension, and the original README and
  ARCHITECTURE.md.

Upstream contributors whose commits are part of this history are credited in
`git log`.

## What The Morning Tab adds

- The Morning Tab name and branding (v0.1.0).
- Planned work is listed under "Roadmap" in the [README](./README.md). Nothing
  on that list is built yet.

## Staying in sync

Upstream fixes can be merged at any time. See "Merging upstream updates" in the
[README](./README.md#merging-upstream-updates).

Thank you, Thariq, for building this and releasing it under an open license.
