# The Morning Tab

**All the news that fits your history.**

> Extended from [ai-newtab](https://github.com/ThariqS/ai-newtab) by [Thariq](https://github.com/ThariqS) ([@trq212](https://x.com/trq212)), MIT licensed. See [CREDITS.md](./CREDITS.md).

[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)
[![CI](https://github.com/mejba13/themorningtab/actions/workflows/ci.yml/badge.svg)](https://github.com/mejba13/themorningtab/actions/workflows/ci.yml)
[![Website](https://img.shields.io/badge/Website-themorningtab.ai-0A66C2.svg)](https://themorningtab.ai)

The Morning Tab replaces Chrome's new-tab page with a front page that's written
for you. An agent looks at what you've actually been browsing, opens the pages you
follow (signed in as you), and writes a fresh homepage from what it finds there,
then rebuilds it in the background so each new tab is up to date.

![An example homepage in a morning-newspaper style](docs/preview.png)
<sub>Illustration from the upstream project. Your homepage is built from your own browsing, so its stories will be different.</sub>

A morning newspaper is just one look. You can describe any look and the next build
follows it: a quiet one-column digest, a dense dashboard, a green-on-black
terminal, a zine.

> **Privacy, up front.** To build your homepage, the extension sends a summary of
> your browsing history (top domains, visit counts, a few page titles) and the
> cleaned-up HTML of up to 8 pages to the Anthropic API, using your own API key.
> Those pages are loaded in your signed-in browser, so they can include private
> content. The agent session and every uploaded page are deleted when each build
> ends. Your API key stays in the extension's local storage. More detail in
> [ARCHITECTURE.md](./ARCHITECTURE.md#privacy).

---

## Install

You need Chrome (or another Chromium browser), [Node.js](https://nodejs.org) 20+,
and an [Anthropic API key](https://console.anthropic.com).

```bash
git clone https://github.com/mejba13/themorningtab.git
cd themorningtab
npx pnpm@10.11.1 install
npx pnpm@10.11.1 build
```

(If you already have [pnpm](https://pnpm.io), plain `pnpm install && pnpm build` works too.)

Then load it into Chrome:

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose `apps/extension/.output/chrome-mv3`.

If Chrome asks whether to keep the changed new-tab page, choose **Keep it**.

## Your first homepage

1. Open a new tab and paste your Anthropic API key. Use a key that is scoped to a
   workspace. An organization-scoped key is rejected by the API.
2. Click **Build today's homepage**.
3. Watch it work. The progress view walks through each step: preparing the
   agent, reading your history, opening pages in your browser, analyzing them,
   and writing your homepage.

The first build takes a few minutes. You can close the tab while it runs, since
the build lives in the extension's background worker and appears in any new tab
you open.

## Settings and customization

Click **⚙️ Settings** on the new tab.

**Instructions.** Anything you write here goes into every build and takes priority
over the agent's own defaults. This box sets both the content and the look:

| You write | You get |
| --- | --- |
| *"A morning newspaper. Serif type, a big masthead, a lead story, a column of briefs."* | A broadsheet front page |
| *"One calm column. No images. Five things worth reading, with one line on why."* | A quiet reading list |
| *"Dense dashboard: GitHub PRs and issues first, then Hacker News, then everything else."* | A work cockpit |
| *"Green-on-black terminal, monospace, like a 1980s BBS."* | Exactly that |
| *"Skip sports and politics. Always show the weather and my next three calendar events."* | Your rules, every day |

Click **Save & rebuild** to apply them right away.

**Sites the agent never reads.** Enter one host per line; subdomains are included,
and `*.example.com` is supported. The editable defaults include common webmail,
sign-in and document hosts. **Save & rebuild** saves the list and applies it to
history summaries and URLs requested through `getPageHtml`. A page that redirects
onto a blocked host is dropped before its content is uploaded. Local-network
addresses (localhost, private IPs, `.local` and `.internal` hosts) are always blocked.

**Model.** Choose which Claude model writes your page:

- **Claude Sonnet 5.5** (default): the best balance of quality and cost.
- **Claude Haiku 5.5**: the fastest and cheapest.
- **Claude Opus 5.5**: the most careful editor, and the most expensive.

The new model takes effect from your next build.

**Rebuild automatically.** On by default. Once your homepage is older than the
interval you pick (6, 12, 24 or 48 hours), the extension rebuilds it quietly in the
background. It only starts after you've built once by hand, and it won't retry a
failed build until the next interval, so it never loops.

**↻ Rebuild** in the top-right corner rebuilds right away.

## Good to know

- **Cost.** Each build is a single agent session billed to your API key. What it
  costs depends on the model and on how much it reads. Haiku is the cheapest
  choice, and you can turn off automatic rebuilds to build only when you ask.
- **What it can see.** It ranks the sites in your history and opens up to 8 of
  them per build. It skips search engines, webmail, banking and logged-out
  marketing pages. Anything it can't open is reported, not hidden.
- **Links are real.** Every link on the page comes from a page the agent actually
  read. It's told never to invent a URL.
- **Interrupted builds.** If Chrome closes mid-build, the new tab offers
  **Resume interrupted build** next time.
- **Updating.** After pulling new code, run `npx pnpm@10.11.1 build` again, then
  click the reload icon on the extension in `chrome://extensions`.

## How it works

1. **`getHistory`**: the agent gets a ranked summary of your most-visited domains.
2. **`getPageHtml`**: it picks up to 8 pages, which the extension opens in a
   background window, cleans up, and mounts into the agent's sandbox as files.
3. **`grep` / `read`**: the agent pulls headlines, posts and links out of those
   files inside its sandbox.
4. **`write`**: it writes one React component, which the new tab renders.

The extension's background worker drives a
[Claude Managed Agents](https://docs.claude.com) session directly, with no server
in between. The two custom tools run in the extension because they need
`chrome.history` and `chrome.tabs`. Everything else happens in the agent's
sandbox, where shell access is off: scraped pages are untrusted input.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the event flow, the layout, and
the gotchas worth knowing.

## Development

```
packages/agent-core   the agent loop: host-agnostic, no chrome.* or node:*
apps/extension        the MV3 extension (WXT + React)
harness               Bun scripts that run agent-core outside Chrome, and test the built extension
```

```bash
pnpm dev                 # WXT with hot reload
pnpm typecheck           # all packages
pnpm test                # unit tests (no API calls; needs Bun)
pnpm extension:test      # loads the built extension into headless Chrome (no API calls)

cp .env.example .env     # add ANTHROPIC_API_KEY, then:
pnpm agent:run           # a full build against the real API, with fixture history
pnpm agent:verify        # check the output actually renders
```

Never commit `.env`. It is in `.gitignore`.

### Merging upstream updates

The original project is kept as the `upstream` remote, so its fixes can be merged:

```bash
git remote add upstream https://github.com/ThariqS/ai-newtab.git   # once, on a fresh clone
git fetch upstream
git merge upstream/main
```

Expect conflicts where upstream touches renamed strings or the `@themorningtab`
package scope. After merging, run `pnpm install`, `pnpm typecheck`, `pnpm test`
and `pnpm build`.

## Roadmap

**Planned, not built.** None of these exist in the code yet.

- [ ] Hosted key option, so a build does not need your own API key
- [ ] Team and agency briefs
- [ ] Bangla edition
- [ ] Scheduled email digest

## Status

Early and experimental. It's a tool you run yourself with your own key. Don't
publish it to a store as-is: anyone with access to the browser profile can read
the stored API key.

## Credits

The Morning Tab is an extended version of
[ai-newtab](https://github.com/ThariqS/ai-newtab), created by
[Thariq](https://github.com/ThariqS) ([@trq212](https://x.com/trq212)). The agent
architecture, the Managed Agents flow and the extension foundation all originated
there. See **[CREDITS.md](./CREDITS.md)** for details and
**[CHANGELOG.md](./CHANGELOG.md)** for what changed in this fork.

## About the maintainer

**Engr Mejba Ahmed** — Senior AI Developer, Software Engineer and Entrepreneur
based in Dhaka, Bangladesh. Founder/CEO of Ramlit Limited, ColorPark Creative
Agency and xCyberSecurity Global Services. 10+ years building AI, full-stack
(Laravel, Next.js, Python/FastAPI) and cloud/DevOps systems across 520+ projects.

Links: <https://mejba.me> and <https://github.com/mejba13>

---

## Developed By

<div align="center">

<img width="380" height="420" alt="engr-mejba-ahmed" src="https://github.com/user-attachments/assets/83e72c39-5eaa-428a-884b-cb4714332487" />

### **Engr Mejba Ahmed**

**AI Developer | Software Engineer | Entrepreneur**

[![Portfolio](https://img.shields.io/badge/Portfolio-mejba.me-10B981?style=for-the-badge&logo=google-chrome&logoColor=white)](https://www.mejba.me)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/mejba)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mejba13)

</div>

---

## License

[MIT](./LICENSE). Copyright (c) 2026 Thariq Shihipar and Copyright (c) 2026 Mejba Ahmed.
