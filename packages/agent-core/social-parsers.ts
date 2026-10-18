/**
 * Per-platform parsers. Each takes a parsed page (any DOM `ParentNode`, so the
 * service worker's linkedom document and a test fixture behave the same) and
 * returns validated items. Page content is untrusted: only the item fields are
 * kept, and every link and thumbnail goes through the platform allowlist.
 *
 * Selectors track each site's markup as of this writing. When a site changes
 * its layout, a parser returns nothing and the platform reports `failed`.
 */
import {
  clipText,
  parseRelativeTime,
  validateItemUrl,
  validateThumbnailUrl,
  type SocialItem,
  type SocialPlatform,
} from "./social";

export interface ParseContext {
  query: string;
  now: Date;
}

type Parser = (doc: ParentNode, ctx: ParseContext) => SocialItem[];

const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const first = (root: ParentNode, ...selectors: string[]) => {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el && text(el)) return el;
  }
  return null;
};

function item(platform: SocialPlatform, ctx: ParseContext, fields: {
  text: string;
  url: string | null;
  author?: string | null;
  thumbnail?: string | null;
  publishedAt?: string | null;
}): SocialItem | null {
  const url = fields.url ? validateItemUrl(platform, fields.url) : null;
  const body = clipText(fields.text);
  if (!url || !body) return null;
  return {
    platform,
    text: body,
    url,
    author: fields.author ? clipText(fields.author) : null,
    thumbnail: validateThumbnailUrl(platform, fields.thumbnail),
    publishedAt: fields.publishedAt ?? null,
    query: ctx.query,
  };
}

/** Drop nulls and repeat links (nested containers often match twice). */
const ORIGINS: Record<SocialPlatform, string> = {
  youtube: "https://www.youtube.com",
  x: "https://x.com",
  linkedin: "https://www.linkedin.com",
  pinterest: "https://www.pinterest.com",
  instagram: "https://www.instagram.com",
};

/**
 * Resolve a scraped href against the platform and keep it only if it stays on
 * the platform. IDs are pulled from the result, so an off-site link that merely
 * contains "/pin/123" can't be rebuilt into a real-looking post URL.
 */
const onPlatform = (platform: SocialPlatform, href: string | null | undefined): URL | null => {
  const url = href ? validateItemUrl(platform, href, ORIGINS[platform]) : null;
  return url ? new URL(url) : null;
};

const compact = (list: (SocialItem | null)[]): SocialItem[] => {
  const seen = new Set<string>();
  return list.filter((x): x is SocialItem => x !== null && !seen.has(x.url) && Boolean(seen.add(x.url)));
};

// ---- YouTube ----------------------------------------------------------------

const YT_ID = /^[\w-]{11}$/;

function youtubeVideo(href: string | null): { id: string; url: string } | null {
  const url = onPlatform("youtube", href);
  if (!url) return null;
  const shorts = url.pathname.match(/^\/shorts\/([\w-]{11})/);
  if (shorts) return { id: shorts[1], url: `https://www.youtube.com/shorts/${shorts[1]}` };
  const id = url.searchParams.get("v");
  if (url.pathname === "/watch" && id && YT_ID.test(id)) {
    return { id, url: `https://www.youtube.com/watch?v=${id}` };
  }
  return null;
}

/** The rendered search results page, used when no API key is set. */
export const parseYouTubeSearch: Parser = (doc, ctx) =>
  compact(
    Array.from(doc.querySelectorAll("ytd-video-renderer")).map((el) => {
      const link = el.querySelector("a#video-title");
      const video = youtubeVideo(link?.getAttribute("href") ?? null);
      if (!video) return null;
      const spans = Array.from(el.querySelectorAll("#metadata-line span")).map(text);
      return item("youtube", ctx, {
        text: link?.getAttribute("title") || text(link),
        url: video.url,
        author: text(first(el, "ytd-channel-name a", "#channel-name a", "ytd-channel-name")) || null,
        // Built from the ID: the rendered <img> is lazy and often empty.
        thumbnail: `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
        publishedAt: parseRelativeTime(spans.find((s) => /ago|streamed/i.test(s)), ctx.now),
      });
    }),
  );

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeEntities = (s: string) =>
  s.replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** A YouTube Data API v3 `search.list` response. */
export function parseYouTubeApi(json: unknown, ctx: ParseContext): SocialItem[] {
  const items = (json as { items?: unknown })?.items;
  if (!Array.isArray(items)) throw new Error("unexpected YouTube API response");
  return compact(
    items.map((raw: any) => {
      const id = raw?.id?.videoId;
      if (typeof id !== "string" || !YT_ID.test(id)) return null;
      const s = raw.snippet ?? {};
      return item("youtube", ctx, {
        text: decodeEntities(String(s.title ?? "")),
        url: `https://www.youtube.com/watch?v=${id}`,
        author: s.channelTitle ? decodeEntities(String(s.channelTitle)) : null,
        thumbnail: s.thumbnails?.medium?.url ?? s.thumbnails?.default?.url ?? null,
        publishedAt: parseRelativeTime(s.publishedAt, ctx.now),
      });
    }),
  );
}

// ---- X ------------------------------------------------------------------------

export const parseXSearch: Parser = (doc, ctx) =>
  compact(
    Array.from(doc.querySelectorAll('article[data-testid="tweet"]')).map((el) => {
      const time = el.querySelector("time");
      const permalink = time?.closest("a")?.getAttribute("href") ?? null;
      // Keep /user/status/123; drop /photo/1, /analytics and the like.
      const path = permalink?.match(/^(?:https:\/\/(?:x|twitter)\.com)?(\/[^/?#]+\/status\/\d+)/)?.[1];
      const name = el.querySelector('[data-testid="User-Name"]');
      const handle = name?.querySelector('a[href^="/"]')?.getAttribute("href")?.slice(1);
      const display = text(name?.querySelector("span"));
      return item("x", ctx, {
        text: text(el.querySelector('[data-testid="tweetText"]')),
        url: path ? `https://x.com${path}` : null,
        author: handle ? (display ? `${display} (@${handle})` : `@${handle}`) : display || null,
        thumbnail: el.querySelector('[data-testid="tweetPhoto"] img')?.getAttribute("src"),
        publishedAt: parseRelativeTime(time?.getAttribute("datetime"), ctx.now),
      });
    }),
  );

// ---- LinkedIn -------------------------------------------------------------------

export const parseLinkedInSearch: Parser = (doc, ctx) =>
  compact(
    Array.from(doc.querySelectorAll('[data-urn^="urn:li:activity:"]')).map((el) => {
      const urn = el.getAttribute("data-urn") ?? "";
      if (!/^urn:li:activity:\d+$/.test(urn)) return null;
      return item("linkedin", ctx, {
        text: text(first(el, ".update-components-text", ".feed-shared-inline-show-more-text", ".feed-shared-text")),
        url: `https://www.linkedin.com/feed/update/${urn}/`,
        author: text(first(el, '.update-components-actor__title span[aria-hidden="true"]', ".update-components-actor__name")) || null,
        thumbnail: el.querySelector(".update-components-image img")?.getAttribute("src"),
        publishedAt: parseRelativeTime(
          text(first(el, '.update-components-actor__sub-description span[aria-hidden="true"]', ".update-components-actor__sub-description")),
          ctx.now,
        ),
      });
    }),
  );

// ---- Pinterest ----------------------------------------------------------------------

export const parsePinterestSearch: Parser = (doc, ctx) =>
  compact(
    Array.from(doc.querySelectorAll('[data-test-id="pin"], [data-grid-item="true"]')).map((el) => {
      const id = onPlatform("pinterest", el.querySelector('a[href*="/pin/"]')?.getAttribute("href"))?.pathname.match(/^\/pin\/(\d+)/)?.[1];
      const img = el.querySelector("img");
      return item("pinterest", ctx, {
        text: img?.getAttribute("alt") || text(el.querySelector('[data-test-id="pin-title"]')),
        url: id ? `https://www.pinterest.com/pin/${id}/` : null,
        author: text(el.querySelector('[data-test-id="pinner-name"]')) || null,
        thumbnail: img?.getAttribute("src"),
        // Search results carry no dates.
        publishedAt: null,
      });
    }),
  );

// ---- Instagram -------------------------------------------------------------------------

/** "Photo by Jane Doe on June 5, 2026. May be an image of text." */
const IG_ALT = /^(?:photo|video|reel)s? (?:shared )?by (.+?) on ([a-z]+ \d{1,2}, \d{4})\.?\s*/i;

export const parseInstagramTag: Parser = (doc, ctx) => {
  const links = Array.from(doc.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
  return compact(
    links.map((a) => {
      const code = onPlatform("instagram", a.getAttribute("href"))?.pathname.match(/^\/(p|reel)\/([\w-]+)/);
      if (!code) return null;
      const img = a.querySelector("img");
      const alt = img?.getAttribute("alt") ?? "";
      const meta = alt.match(IG_ALT);
      const date = meta ? Date.parse(meta[2]) : NaN;
      return item("instagram", ctx, {
        text: alt.replace(IG_ALT, "") || (meta ? `Post by ${meta[1]}` : ""),
        url: `https://www.instagram.com/${code[1]}/${code[2]}/`,
        author: meta?.[1] ?? null,
        thumbnail: img?.getAttribute("src"),
        publishedAt: Number.isNaN(date) ? null : new Date(date).toISOString(),
      });
    }),
  );
};

export const SOCIAL_PAGE_PARSERS: Record<SocialPlatform, Parser> = {
  youtube: parseYouTubeSearch,
  x: parseXSearch,
  linkedin: parseLinkedInSearch,
  pinterest: parsePinterestSearch,
  instagram: parseInstagramTag,
};

const LOGIN_PATHS: Record<SocialPlatform, RegExp> = {
  youtube: /^\/(signin|accounts)/,
  x: /^\/(i\/flow\/login|login|i\/flow\/signup)/,
  linkedin: /^\/(authwall|login|checkpoint|uas\/login|signup)/,
  pinterest: /^\/(login|signup)/,
  instagram: /^\/accounts\/(login|signup)/,
};

/**
 * Whether the capture landed on a login wall rather than results. A redirect
 * to a sign-in path is decisive; otherwise an empty page with a password
 * field or the platform's own login button counts.
 */
export function isLoginWall(platform: SocialPlatform, finalUrl: string, doc: ParentNode, itemCount: number): boolean {
  try {
    const url = new URL(finalUrl);
    if (LOGIN_PATHS[platform].test(url.pathname)) return true;
    if (url.hostname.endsWith("accounts.google.com")) return true;
  } catch {
    // Unparseable final URL: judge by content.
  }
  if (itemCount > 0) return false;
  return Boolean(
    doc.querySelector('input[type="password"], [data-testid="loginButton"], form[action*="login"]'),
  );
}
