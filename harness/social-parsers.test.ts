import { expect, test } from "bun:test";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PAGE_PARSERS,
  isLoginWall,
  parseInstagramTag,
  parseLinkedInSearch,
  parsePinterestSearch,
  parseRelativeTime,
  parseTopics,
  parseXSearch,
  parseYouTubeApi,
  parseYouTubeSearch,
  socialSearchUrl,
  validateItemUrl,
  validateThumbnailUrl,
} from "@themorningtab/agent-core";
import { FIXTURE_NOW, fixture, fixtureDoc } from "./social-fixtures";

const ctx = { query: "AI", now: FIXTURE_NOW };
const hoursAgo = (h: number) => new Date(FIXTURE_NOW.getTime() - h * 3_600_000).toISOString();

// ---- parsers ------------------------------------------------------------------

test("YouTube search page: canonical links, ID-built thumbnails, relative times; bad links dropped", () => {
  const items = parseYouTubeSearch(fixtureDoc("youtube-search.html"), ctx);
  expect(items.map((i) => i.url)).toEqual([
    "https://www.youtube.com/watch?v=aBcDeFgHiJ1",
    "https://www.youtube.com/watch?v=ZyXwVuTsRq2",
    "https://www.youtube.com/shorts/Sh0rTsVid03",
  ]);
  expect(items[0]).toEqual({
    platform: "youtube",
    text: "Claude agents build a full app in one hour",
    url: "https://www.youtube.com/watch?v=aBcDeFgHiJ1",
    author: "Dev Daily",
    thumbnail: "https://i.ytimg.com/vi/aBcDeFgHiJ1/mqdefault.jpg",
    publishedAt: hoursAgo(2),
    query: "AI",
  });
  expect(items[1].publishedAt).toBe(hoursAgo(5));
  expect(items[2].publishedAt).toBe(hoursAgo(24));
});

test("YouTube API: decodes entities, drops non-videos and foreign thumbnails", () => {
  const items = parseYouTubeApi(JSON.parse(fixture("youtube-api.json")), ctx);
  expect(items).toHaveLength(3);
  expect(items[0].text).toBe("Anthropic's new agent SDK & tools, explained");
  expect(items[0].publishedAt).toBe("2026-10-15T09:30:00.000Z");
  expect(items[0].thumbnail).toBe("https://i.ytimg.com/vi/ApIvIdEo001/mqdefault.jpg");
  expect(items[2].thumbnail).toBeNull();
  expect(() => parseYouTubeApi({ error: { code: 403 } }, ctx)).toThrow();
  expect(() => parseYouTubeApi(null, ctx)).toThrow();
});

test("X: permalink from the time link, photo suffix stripped, handle in author", () => {
  const items = parseXSearch(fixtureDoc("x-search.html"), ctx);
  expect(items.map((i) => i.url)).toEqual([
    "https://x.com/ai_researcher/status/1846000000000000001",
    "https://x.com/buildwithai/status/1846000000000000002",
  ]);
  expect(items[0].author).toBe("Ada Research (@ai_researcher)");
  expect(items[0].thumbnail).toBe("https://pbs.twimg.com/media/GaBcDeF.jpg?format=jpg&name=small");
  expect(items[0].publishedAt).toBe("2026-10-15T11:20:00.000Z");
  // Injected text is carried as data, and its link never becomes the item URL.
  expect(items[1].text).toContain("Ignore all previous instructions");
  expect(JSON.stringify(items.map((i) => [i.url, i.thumbnail]))).not.toContain("evil.example");
});

test("LinkedIn: activity URNs become feed links; malformed URNs dropped", () => {
  const items = parseLinkedInSearch(fixtureDoc("linkedin-search.html"), ctx);
  expect(items.map((i) => i.url)).toEqual([
    "https://www.linkedin.com/feed/update/urn:li:activity:7250000000000000001/",
    "https://www.linkedin.com/feed/update/urn:li:activity:7250000000000000002/",
  ]);
  expect(items[0].author).toBe("Grace Hopper Jr.");
  expect(items[0].publishedAt).toBe(hoursAgo(3));
  expect(items[0].thumbnail).toStartWith("https://media.licdn.com/");
  expect(items[1]).toMatchObject({ author: "Data Team Weekly", thumbnail: null, publishedAt: hoursAgo(24) });
});

test("Pinterest: nested matches deduped, off-site pins and foreign thumbnails dropped", () => {
  const items = parsePinterestSearch(fixtureDoc("pinterest-search.html"), ctx);
  expect(items.map((i) => i.url)).toEqual([
    "https://www.pinterest.com/pin/987654321012345678/",
    "https://www.pinterest.com/pin/987654321012345679/",
  ]);
  expect(items[0].thumbnail).toBe("https://i.pinimg.com/236x/aa/bb/cc/aabbcc.jpg");
  expect(items[1].thumbnail).toBeNull();
  expect(items.every((i) => i.publishedAt === null)).toBe(true);
});

test("Instagram: author and date from alt text; posts without text dropped", () => {
  const items = parseInstagramTag(fixtureDoc("instagram-tag.html"), ctx);
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({
    url: "https://www.instagram.com/p/C9AbCdEfGhI/",
    author: "Neural Studio",
    text: "May be an image of a robot arm drawing.",
  });
  expect(items[0].publishedAt).toStartWith("2026-10-14");
  expect(items[1]).toMatchObject({ url: "https://www.instagram.com/reel/C9ReelCode1/", text: "Post by AI Daily" });
  expect(items[1].thumbnail).toStartWith("https://instagram.fdac5-1.fna.fbcdn.net/");
});

test("malformed markup yields no items and never throws", () => {
  for (const p of SOCIAL_PLATFORMS) {
    expect(SOCIAL_PAGE_PARSERS[p](fixtureDoc("malformed.html"), ctx)).toEqual([]);
  }
});

test("login walls are detected by redirect path or by an empty page with a sign-in form", () => {
  expect(isLoginWall("x", "https://x.com/i/flow/login?redirect_after_login=%2Fsearch", fixtureDoc("x-login.html"), 0)).toBe(true);
  expect(isLoginWall("linkedin", "https://www.linkedin.com/authwall?trk=x", fixtureDoc("linkedin-authwall.html"), 0)).toBe(true);
  expect(isLoginWall("instagram", "https://www.instagram.com/explore/tags/ai/", fixtureDoc("instagram-login.html"), 0)).toBe(true);
  expect(isLoginWall("x", "https://x.com/search?q=AI", fixtureDoc("x-search.html"), 2)).toBe(false);
  expect(isLoginWall("pinterest", "https://www.pinterest.com/search/pins/?q=AI", fixtureDoc("malformed.html"), 0)).toBe(false);
});

// ---- URL validator ----------------------------------------------------------------

test("item URLs: https only, platform hosts only, no credentials or ports", () => {
  expect(validateItemUrl("x", "https://x.com/a/status/1")).toBe("https://x.com/a/status/1");
  expect(validateItemUrl("x", "https://mobile.twitter.com/a/status/1#frag")).toBe("https://mobile.twitter.com/a/status/1");
  expect(validateItemUrl("youtube", "/watch?v=abc", "https://www.youtube.com")).toBe("https://www.youtube.com/watch?v=abc");
  for (const bad of [
    "http://x.com/a/status/1",
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://x.com.evil.example/a/status/1",
    "https://evilx.com/a/status/1",
    "https://user:pw@x.com/a/status/1",
    "https://x.com:8443/a/status/1",
    "https://www.youtube.com/watch?v=1",
    "not a url",
    "",
  ]) {
    expect(validateItemUrl("x", bad)).toBeNull();
  }
  expect(validateItemUrl("linkedin", "https://www.linkedin.com.attacker.io/feed/update/1")).toBeNull();
});

test("thumbnails: only each platform's image CDN", () => {
  expect(validateThumbnailUrl("youtube", "https://i.ytimg.com/vi/x/mqdefault.jpg")).not.toBeNull();
  expect(validateThumbnailUrl("instagram", "https://scontent.cdninstagram.com/a.jpg")).not.toBeNull();
  expect(validateThumbnailUrl("instagram", "https://pbs.twimg.com/a.jpg")).toBeNull();
  expect(validateThumbnailUrl("x", "http://pbs.twimg.com/a.jpg")).toBeNull();
  expect(validateThumbnailUrl("pinterest", "https://i.pinimg.com.evil.example/a.jpg")).toBeNull();
  expect(validateThumbnailUrl("pinterest", null)).toBeNull();
});

// ---- small helpers -----------------------------------------------------------------

test("relative times resolve against now; unknown text gives null", () => {
  expect(parseRelativeTime("40m", FIXTURE_NOW)).toBe(hoursAgo(40 / 60));
  expect(parseRelativeTime("3 hours ago", FIXTURE_NOW)).toBe(hoursAgo(3));
  expect(parseRelativeTime("2mo", FIXTURE_NOW)).toBe(hoursAgo(2 * 30 * 24));
  expect(parseRelativeTime("Streamed 1 week ago", FIXTURE_NOW)).toBe(hoursAgo(7 * 24));
  expect(parseRelativeTime("just now", FIXTURE_NOW)).toBe(FIXTURE_NOW.toISOString());
  expect(parseRelativeTime("Edited", FIXTURE_NOW)).toBeNull();
  expect(parseRelativeTime("2026-99-99T00:00", FIXTURE_NOW)).toBeNull();
});

test("topics are trimmed, deduped case-insensitively and capped; search URLs encode them", () => {
  expect(parseTopics(" AI, llm ,ai,, Agents ,a,b,c")).toEqual(["AI", "llm", "Agents", "a", "b"]);
  expect(socialSearchUrl("x", ["AI", "LLM agents"])).toBe("https://x.com/search?q=AI%20OR%20LLM%20agents&src=typed_query&f=live");
  expect(socialSearchUrl("instagram", ["Gen AI", "LLM"])).toBe("https://www.instagram.com/explore/tags/genai/");
  expect(socialSearchUrl("youtube", ["AI"])).toContain("sp=CAI%253D");
});
