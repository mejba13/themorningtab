# Social Pulse: implementation plan

Social Pulse adds a "latest posts about a topic" section to each homepage. It
covers YouTube, X, LinkedIn, Pinterest and Instagram. The extension collects and
parses the posts. The agent only lays them out.

## Data shape

```ts
type SocialPlatform = "youtube" | "x" | "linkedin" | "pinterest" | "instagram";

interface SocialItem {
  platform: SocialPlatform;
  text: string;          // title or text snippet, whitespace-collapsed, capped at 280 chars
  url: string;           // https, host on the platform allowlist, canonical post URL
  author: string | null;
  thumbnail: string | null; // https, host on the platform's image-CDN allowlist, else null
  publishedAt: string | null; // ISO 8601; relative times ("3h") are resolved at parse time
  query: string;         // the search that produced it
}

type SocialStatus = "ok" | "signed-out" | "blocked" | "failed" | "skipped";

interface SocialPulseResult {
  topics: string[];
  generatedAt: string;
  platforms: Record<SocialPlatform, { status: SocialStatus; detail?: string; count: number }>;
  items: SocialItem[];  // grouped by platform, newest first, capped per platform
}
```

## How items reach the page

1. The agent calls `getSocialPulse` (no input). The kickoff message tells it to call
   it only when Social Pulse is on.
2. The orchestrator calls `bridge.getSocialPulse({ blockedSites })`.
3. The extension runs each enabled adapter one after another, with a random
   1.5–4 s pause between platforms:
   - **YouTube with a key:** Data API v3 `search.list`. Results are cached for the
     rebuild interval.
   - **YouTube without a key, and X, LinkedIn, Pinterest and Instagram:** load one
     search page in the existing background scraper window. A new content script
     returns the rendered HTML without scrolling, clicking or typing. The page is
     parsed with `linkedom` in the service worker.
4. Every item URL and thumbnail goes through a strict validator. Then the item URL
   goes through the user's blocklist.
5. The orchestrator uploads the result as JSON to
   `/mnt/session/uploads/social/pulse.json`, the same way `getPageHtml` mounts pages.
   The tool result carries `mountPath`, `bytes`, per-platform status and item counts.
   The items stay in the file, so the transcript doesn't carry them twice.
6. The agent reads the file and writes a "Social Pulse" section, grouped by
   platform and newest first. It may use only URLs from the file.
7. The last per-platform status is saved to `chrome.storage.local` for Settings.

## Files

| Package | File | Change |
|---|---|---|
| agent-core | `social.ts` (new) | Types, platform table, search-URL builders, URL validators, relative-time parser, normalize/sort/cap, invented-link audit |
| agent-core | `social-parsers.ts` (new) | Pure parsers over a DOM `ParentNode`, plus the YouTube API JSON parser and login-wall detection |
| agent-core | `types.ts`, `schemas.ts`, `setup.ts`, `prompt.ts`, `orchestrator.ts`, `index.ts` | New tool, its dispatch and mounting, prompt section, kickoff flag |
| extension | `lib/social/*.ts` (new) | YouTube API client and cache, page capture, adapter runner |
| extension | `entrypoints/social-capture.content.ts` (new) | Returns rendered HTML. No scroll, no clicks. |
| extension | `lib/storage.ts`, `lib/browser-bridge.ts`, `lib/build-manager.ts` | Settings, YouTube key, status, bridge method |
| extension | `newtab/App.tsx`, `newtab/components/SocialPulseSettings.tsx` (new), `SettingsModal.tsx` | Settings panel |
| harness | `social-*.test.ts`, `fixtures/social/*` (new) | Parser, validator, fail-soft and link-audit tests |
| harness | `test-social-pulse-visual.ts` (new) | Playwright screenshots from fixture data, no network to platforms |
| docs | `README.md`, `ARCHITECTURE.md` | Privacy note, layout |

## Permissions and CSP

**No manifest change is needed. This deviates from the brief on purpose.**

- **Host permissions.** The manifest already grants `<all_urls>`, because
  `getPageHtml` must open any site the user follows. That already covers
  `www.googleapis.com`, `youtube.com`, `x.com`, `linkedin.com`, `pinterest.com`
  and `instagram.com`. Adding narrower entries next to `<all_urls>` grants nothing
  and only suggests a restriction that does not exist. The real restriction is in
  code: the per-platform allowlists in `social.ts`.

  | Host | Why it is needed | Already covered by |
  |---|---|---|
  | `https://www.googleapis.com/*` | YouTube Data API v3 `search.list` | `<all_urls>` |
  | `https://www.youtube.com/*` | Fallback search page when no API key is set | `<all_urls>` |
  | `https://x.com/*` | X search, Latest tab | `<all_urls>` |
  | `https://www.linkedin.com/*` | LinkedIn content search | `<all_urls>` |
  | `https://www.pinterest.com/*` | Pinterest pin search | `<all_urls>` |
  | `https://www.instagram.com/*` | Instagram tag page | `<all_urls>` |

  The image CDNs (`i.ytimg.com`, `pbs.twimg.com`, `media.licdn.com`, `i.pinimg.com`,
  `*.cdninstagram.com`, `*.fbcdn.net`) are never fetched by the extension. The
  homepage iframe loads them, so they need no host permission.

- **CSP.** The homepage renders inside Sandpack's iframe, which is served from
  CodeSandbox's origin. The extension page's CSP does not govern image loads in
  that iframe. MV3's default extension CSP (`script-src 'self'; object-src 'self'`)
  also sets no `img-src`. Adding an `img-src` would not change what renders. A
  thumbnail is shown only if its URL passed the CDN allowlist at parse time.

## Security rules

- The YouTube key is stored like the Anthropic key, in `chrome.storage.local`
  under its own key. It is sent only to `www.googleapis.com`. It never appears in
  logs, errors, the tool result or the mounted file. API errors are reported by
  status code only.
- Cookies and session tokens are never read. Capture returns rendered HTML only,
  and parsers keep only the item fields above.
- Search URLs and final (post-redirect) URLs go through the existing blocklist and
  the private-network block. A platform the user has blocked reports `blocked`.
- Item URLs: `https:` only, no credentials, no port, host must equal or be a
  subdomain of that platform's allowlist. Anything else is dropped.
- Shell access stays off in the sandbox. The JSON file is untrusted data, and the
  prompt says so.

## Risks

- **Selectors break.** X, LinkedIn, Instagram and Pinterest change their markup
  often. The parsers are built from synthetic fixtures that model each site's
  known structure. They are **not** checked against live pages, because the brief
  forbids hitting real platform pages without approval. A breakage shows up as a
  `failed` status, not a broken build.
- **Platform automation policies.** Reading search pages in a signed-in session
  may break X, LinkedIn and Instagram terms, and can flag an account. That is why
  these platforms are off by default, show a risk note, and load at most one page
  per build with no interaction.
- **Instagram thumbnails** are signed CDN URLs that expire, and may refuse
  cross-origin embedding. Expect broken images on older homepages.
- **YouTube quota.** `search.list` costs 100 units per call (10,000/day default).
  There is one call per build, topics are OR-joined into one query, and results
  are cached for the rebuild interval.
- **Agent definition change.** The new tool changes the agent fingerprint, so the
  first build after updating calls `agents.update` once.
