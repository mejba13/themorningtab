/**
 * Runs the enabled Social Pulse adapters one after another. Host-agnostic: the
 * extension injects page capture, HTML parsing, the YouTube API client and the
 * cache, so the same code runs under test with fixtures.
 *
 * Every adapter fails soft. A login wall, an empty page, a parse error or a
 * blocked host becomes a status for that platform, never a failed build.
 */
import { SOCIAL_PAGE_PARSERS, isLoginWall } from "./social-parsers";
import { isAllowedUrl } from "./site-filter";
import {
  SOCIAL_PLATFORMS,
  emptyPlatformReports,
  finalizeItems,
  socialSearchUrl,
  type SocialItem,
  type SocialPlatform,
  type SocialPulseResult,
  type SocialPulseSettings,
} from "./social";

export interface SocialPulseDeps {
  settings: SocialPulseSettings;
  blockedSites: string[];
  youtubeApiKey?: string | null;
  now: Date;
  /** Load one page in the signed-in browser and return its rendered markup. */
  capture(url: string): Promise<{ finalUrl: string; html: string }>;
  parseHtml(html: string): ParentNode;
  searchYouTube?(apiKey: string, topics: string[], now: Date): Promise<SocialItem[]>;
  /** Cached YouTube API items for these topics, if still fresh. */
  readYouTubeCache?(signature: string): Promise<SocialItem[] | undefined>;
  writeYouTubeCache?(signature: string, items: SocialItem[]): Promise<void>;
  /** Pause between platform page loads. */
  sleep(ms: number): Promise<void>;
  random?: () => number;
}

/** 1.5–4 s between page loads, so a build never fires requests back to back. */
export const SOCIAL_DELAY_MS = { min: 1_500, max: 4_000 } as const;

class Skip extends Error {
  constructor(readonly status: "blocked" | "signed-out" | "failed", message: string) {
    super(message);
  }
}

export async function collectSocialPulse(deps: SocialPulseDeps): Promise<SocialPulseResult> {
  const { settings, now } = deps;
  const topics = settings.topics;
  const query = topics.join(" OR ");
  const platforms = emptyPlatformReports("skipped", "turned off");
  const items: SocialItem[] = [];
  const result = (): SocialPulseResult => ({ topics, generatedAt: now.toISOString(), platforms, items });

  if (!settings.enabled || topics.length === 0) {
    for (const p of SOCIAL_PLATFORMS) platforms[p] = { status: "skipped", detail: "Social Pulse is off", count: 0 };
    return result();
  }

  let pagesLoaded = 0;
  const random = deps.random ?? Math.random;

  const fromPage = async (platform: SocialPlatform): Promise<SocialItem[]> => {
    const url = socialSearchUrl(platform, topics);
    if (!isAllowedUrl(url, deps.blockedSites)) throw new Skip("blocked", "blocked by your settings");
    if (pagesLoaded++ > 0) {
      await deps.sleep(SOCIAL_DELAY_MS.min + Math.floor(random() * (SOCIAL_DELAY_MS.max - SOCIAL_DELAY_MS.min)));
    }
    const page = await deps.capture(url);
    // A redirect onto a blocked host: drop what was read before parsing it.
    if (!isAllowedUrl(page.finalUrl, deps.blockedSites)) throw new Skip("blocked", "redirected to a blocked site");
    const doc = deps.parseHtml(page.html);
    const parsed = SOCIAL_PAGE_PARSERS[platform](doc, { query, now });
    if (isLoginWall(platform, page.finalUrl, doc, parsed.length)) throw new Skip("signed-out", "sign in to this site in Chrome");
    if (parsed.length === 0) throw new Skip("failed", "no posts found (the page layout may have changed)");
    return parsed;
  };

  const fromYouTubeApi = async (apiKey: string): Promise<SocialItem[]> => {
    if (!deps.searchYouTube) throw new Skip("failed", "the YouTube API is unavailable here");
    const signature = topics.join("|").toLowerCase();
    const cached = await deps.readYouTubeCache?.(signature);
    if (cached) return cached;
    const fresh = await deps.searchYouTube(apiKey, topics, now);
    await deps.writeYouTubeCache?.(signature, fresh);
    return fresh;
  };

  for (const platform of SOCIAL_PLATFORMS) {
    if (!settings.platforms[platform]) continue;
    try {
      const apiKey = platform === "youtube" ? deps.youtubeApiKey : null;
      const raw = apiKey ? await fromYouTubeApi(apiKey) : await fromPage(platform);
      const kept = finalizeItems(
        raw.filter((item) => item.platform === platform && isAllowedUrl(item.url, deps.blockedSites)),
        settings.perPlatform,
      );
      items.push(...kept);
      platforms[platform] = kept.length
        ? { status: "ok", count: kept.length, ...(apiKey ? { detail: "YouTube Data API" } : {}) }
        : { status: "failed", detail: "no posts found", count: 0 };
    } catch (err) {
      platforms[platform] =
        err instanceof Skip
          ? { status: err.status, detail: err.message, count: 0 }
          : { status: "failed", detail: err instanceof Error ? err.message : String(err), count: 0 };
    }
  }
  return result();
}
