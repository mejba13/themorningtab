import { expect, test } from "bun:test";
import type Anthropic from "@anthropic-ai/sdk";
import {
  SOCIAL_DELAY_MS,
  buildKickoffMessage,
  collectSocialPulse,
  findUnlistedSocialLinks,
  parseYouTubeSearch,
  runHomepageBuild,
  type BrowserBridge,
  type KVStore,
  type SocialPulseResult,
} from "@themorningtab/agent-core";
import { FIXTURE_NOW, fixture, fixtureDeps, fixtureHomepage, fixturePulse, renderHomepage } from "./social-fixtures";
import { parseHTML } from "linkedom";

// ---- fail-soft adapter runner --------------------------------------------------------

test("every platform reports ok from good pages, newest first, capped per platform", async () => {
  const pulse = await fixturePulse();
  for (const p of ["youtube", "x", "linkedin", "pinterest", "instagram"] as const) {
    expect(pulse.platforms[p].status).toBe("ok");
  }
  expect(pulse.platforms.youtube.detail).toBe("YouTube Data API");
  const yt = pulse.items.filter((i) => i.platform === "youtube").map((i) => i.publishedAt);
  expect(yt).toEqual([...yt].sort().reverse());
  const deps = fixtureDeps({ settings: { ...fixtureDeps().settings, perPlatform: 1 } });
  const capped = await collectSocialPulse(deps);
  expect(capped.items).toHaveLength(5);
});

test("login walls, empty pages, parse errors and thrown captures fail soft per platform", async () => {
  const pulse = await collectSocialPulse(
    fixtureDeps({
      pages: {
        x: { file: "x-login.html", finalUrl: "https://x.com/i/flow/login" },
        linkedin: { file: "linkedin-authwall.html", finalUrl: "https://www.linkedin.com/authwall" },
        pinterest: { file: "malformed.html" },
        instagram: new Error("timed out loading the page"),
      },
    }),
  );
  expect(pulse.platforms.youtube.status).toBe("ok");
  expect(pulse.platforms.x).toMatchObject({ status: "signed-out", count: 0 });
  expect(pulse.platforms.linkedin.status).toBe("signed-out");
  expect(pulse.platforms.pinterest).toMatchObject({ status: "failed", detail: expect.stringContaining("no posts found") });
  expect(pulse.platforms.instagram).toMatchObject({ status: "failed", detail: "timed out loading the page" });
  expect(pulse.items.every((i) => i.platform === "youtube")).toBe(true);
});

test("one page per platform, no delay before the first, a bounded random delay between the rest", async () => {
  const deps = fixtureDeps();
  await collectSocialPulse(deps);
  expect(deps.captured).toHaveLength(5);
  expect(new Set(deps.captured.map((u) => new URL(u).hostname)).size).toBe(5);
  expect(deps.sleeps).toHaveLength(4);
  for (const ms of deps.sleeps) {
    expect(ms).toBeGreaterThanOrEqual(SOCIAL_DELAY_MS.min);
    expect(ms).toBeLessThanOrEqual(SOCIAL_DELAY_MS.max);
  }
});

test("blocked platforms and redirects onto blocked hosts never get parsed", async () => {
  const deps = fixtureDeps({
    blockedSites: ["x.com", "evil.example"],
    pages: { linkedin: { file: "linkedin-search.html", finalUrl: "https://evil.example/landing" } },
  });
  const pulse = await collectSocialPulse(deps);
  expect(pulse.platforms.x).toMatchObject({ status: "blocked", count: 0 });
  expect(deps.captured.some((u) => u.includes("x.com"))).toBe(false);
  expect(pulse.platforms.linkedin).toMatchObject({ status: "blocked", detail: "redirected to a blocked site" });
  expect(pulse.items.some((i) => i.platform === "linkedin" || i.platform === "x")).toBe(false);
});

test("explicitly disabled collection and turned-off platforms are skipped without loading anything", async () => {
  const off = fixtureDeps({ settings: { ...fixtureDeps().settings, enabled: false } });
  const pulse = await collectSocialPulse(off);
  expect(off.captured).toEqual([]);
  expect(Object.values(pulse.platforms).every((r) => r.status === "skipped")).toBe(true);

  const ytOnly = fixtureDeps({ settings: { ...fixtureDeps().settings, platforms: { youtube: true, x: false, linkedin: false, pinterest: false, instagram: false } } });
  const result = await collectSocialPulse(ytOnly);
  expect(ytOnly.captured).toHaveLength(1);
  expect(result.platforms.x).toMatchObject({ status: "skipped", detail: "turned off" });
});

test("YouTube API: cache hit skips the call; an API error fails soft without leaking the key", async () => {
  let calls = 0;
  const cached = await collectSocialPulse(
    fixtureDeps({
      youtubeApiKey: "AIzaSECRET",
      searchYouTube: async () => (calls++, []),
      readYouTubeCache: async () => parseYouTubeSearch(parseHTML(fixture("youtube-search.html")).document as unknown as ParentNode, { query: "AI", now: FIXTURE_NOW }),
    }),
  );
  expect(calls).toBe(0);
  expect(cached.platforms.youtube.status).toBe("ok");

  const failing = await collectSocialPulse(
    fixtureDeps({
      youtubeApiKey: "AIzaSECRET",
      searchYouTube: async () => { throw new Error("YouTube API returned HTTP 403 (quota exceeded or key not allowed for YouTube Data API v3)"); },
    }),
  );
  expect(failing.platforms.youtube.status).toBe("failed");
  expect(failing.platforms.x.status).toBe("ok");
  expect(JSON.stringify(failing)).not.toContain("AIzaSECRET");
});

// ---- orchestrator: the getSocialPulse tool -------------------------------------------

async function runSocialTool(opts: { socialPulse: boolean; pulse?: SocialPulseResult; hostHasPulse?: boolean; homepage?: string }) {
  const results: any[] = [];
  const uploads: { name: string; body: string }[] = [];
  const mounts: string[] = [];
  const logs: string[] = [];
  let kickoff = "";
  async function* stream() {
    yield { id: "pulse", type: "agent.custom_tool_use", name: "getSocialPulse", input: {} };
  }
  const client = { beta: {
    agents: { retrieve: async () => ({}), update: async () => ({}) },
    environments: { retrieve: async () => ({}) },
    sessions: {
      create: async () => ({ id: "session" }),
      retrieve: async () => ({ status: "idle" }), delete: async () => {},
      resources: { add: async (_id: string, body: any) => (mounts.push(body.mount_path), { mount_path: body.mount_path }) },
      events: {
        stream: async () => stream(),
        list: async function* () {},
        send: async (_id: string, body: any) => {
          for (const e of body.events) {
            if (e.type === "user.message") kickoff = e.content[0].text;
            if (e.type === "user.custom_tool_result") results.push(e);
          }
        },
      },
    },
    files: {
      list: async function* () { yield { id: "output", filename: "homepage.tsx" }; },
      download: async () => new Response(opts.homepage ?? "export default function PersonalizedHomepage() {}"),
      upload: async ({ file }: { file: File }) => { uploads.push({ name: file.name, body: await file.text() }); return { id: `file-${uploads.length}` }; },
      delete: async () => {},
    },
  } } as unknown as Anthropic;
  const store: KVStore = { get: async <T>(key: string) => (key === "uploadedFileIds" ? [] : "cached") as T, set: async () => {}, remove: async () => {} };
  const bridge: BrowserBridge = {
    getHistory: async () => ({ sites: [], totalSitesSeen: 0 }),
    getPageHtml: async () => ({ pages: [], failed: [] }),
    ...(opts.hostHasPulse === false ? {} : { getSocialPulse: async () => opts.pulse ?? (await fixturePulse()) }),
  };
  await runHomepageBuild({ client, store, bridge, socialPulse: opts.socialPulse, blockedSites: [], callbacks: { onLog: (l) => logs.push(l) } });
  return { result: JSON.parse(results[0].content[0].text), uploads, mounts, logs, kickoff };
}

test("getSocialPulse mounts the items as JSON and returns statuses, not the items", async () => {
  const { result, uploads, mounts, kickoff } = await runSocialTool({ socialPulse: true });
  expect(mounts).toEqual(["/mnt/session/uploads/social/pulse.json"]);
  expect(result.mountPath).toBe("/mnt/session/uploads/social/pulse.json");
  expect(result.items).toBeUndefined();
  expect(result.platforms.x.status).toBe("ok");
  const file = JSON.parse(uploads[0].body);
  expect(file.items.length).toBe(result.itemCount);
  expect(kickoff).toContain("Social Pulse: on");
});

test("the orchestrator re-validates items, so a buggy host can't pass a bad link through", async () => {
  const pulse = await fixturePulse();
  pulse.items.push(
    { platform: "x", text: "phish", url: "https://evil.example/x/status/1", author: null, thumbnail: null, publishedAt: null, query: "AI" },
    { platform: "youtube", text: "http", url: "http://www.youtube.com/watch?v=aaaaaaaaaaa", author: null, thumbnail: null, publishedAt: null, query: "AI" },
    { platform: "pinterest", text: "bad thumb", url: "https://www.pinterest.com/pin/1/", author: null, thumbnail: "https://evil.example/t.jpg", publishedAt: null, query: "AI" },
  );
  const { uploads, logs } = await runSocialTool({ socialPulse: true, pulse });
  const body = uploads[0].body;
  expect(body).not.toContain("https://evil.example/x/status/1");
  expect(body).not.toContain("http://www.youtube.com");
  expect(body).not.toContain("evil.example/t.jpg");
  expect(body).toContain("https://www.pinterest.com/pin/1/");
  expect(logs.some((l) => l.includes("dropped 2 item(s)"))).toBe(true);
});

test("off, or on a host without the capability, nothing is collected or uploaded", async () => {
  for (const opts of [{ socialPulse: false }, { socialPulse: true, hostHasPulse: false }]) {
    const { result, uploads } = await runSocialTool(opts);
    expect(uploads).toEqual([]);
    expect(result.mountPath).toBeNull();
    expect(Object.values(result.platforms).every((r: any) => r.status === "skipped")).toBe(true);
  }
  expect(buildKickoffMessage({ now: FIXTURE_NOW })).toContain("Do not call getSocialPulse");
});

// ---- no invented links ------------------------------------------------------------------

test("every social link the fixture homepage renders exists in the tool output", async () => {
  const pulse = await fixturePulse();
  const html = renderHomepage(fixtureHomepage(pulse));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  const known = new Set(pulse.items.map((i) => i.url));
  expect(hrefs.length).toBe(pulse.items.length);
  expect(hrefs.filter((h) => !known.has(h))).toEqual([]);
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  const thumbs = new Set(pulse.items.map((i) => i.thumbnail).filter(Boolean));
  expect(srcs.filter((s) => !thumbs.has(s))).toEqual([]);
});

test("the link audit flags an invented post link and ignores ordinary links", async () => {
  const pulse = await fixturePulse();
  const real = pulse.items[0].url;
  const code = `<a href="${real}"/> <a href="https://x.com/someone/status/999"/> <a href="https://news.ycombinator.com/item?id=1"/> <a href="https://www.youtube.com/@channel"/>`;
  expect(findUnlistedSocialLinks(code, pulse.items)).toEqual(["https://x.com/someone/status/999"]);
});

test("an invented post link in the deliverable is logged after the build", async () => {
  const { logs } = await runSocialTool({ socialPulse: true, homepage: 'export default function PersonalizedHomepage() { return <a href="https://www.instagram.com/p/FAKE123/">x</a>; }' });
  expect(logs.some((l) => l.includes("not from Social Pulse") && l.includes("instagram.com/p/FAKE123"))).toBe(true);
});
