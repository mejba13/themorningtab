/**
 * Social Pulse: the latest posts about a topic from a fixed set of platforms.
 *
 * The extension collects and parses posts; the agent only lays them out. Every
 * URL that leaves this module has passed a per-platform allowlist, so the model
 * never sees a link the extension did not validate.
 */

export const SOCIAL_PLATFORMS = ["youtube", "x", "linkedin", "pinterest", "instagram"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialStatus = "ok" | "signed-out" | "blocked" | "failed" | "skipped";

export interface SocialItem {
  platform: SocialPlatform;
  /** Title or text snippet, whitespace-collapsed and capped. */
  text: string;
  url: string;
  author: string | null;
  thumbnail: string | null;
  /** ISO 8601. Relative times are resolved when parsed. */
  publishedAt: string | null;
  /** The search that produced the item. */
  query: string;
}

export interface SocialPlatformReport {
  status: SocialStatus;
  detail?: string;
  count: number;
}

export interface SocialPulseResult {
  topics: string[];
  generatedAt: string;
  platforms: Record<SocialPlatform, SocialPlatformReport>;
  items: SocialItem[];
}

/** What the agent gets back; the items themselves live in the mounted file. */
export interface GetSocialPulseResult {
  mountPath: string | null;
  bytes: number;
  topics: string[];
  itemCount: number;
  platforms: Record<SocialPlatform, SocialPlatformReport>;
}

export interface SocialPulseSettings {
  enabled: boolean;
  /** Comma-separated in the UI; stored as a list. */
  topics: string[];
  platforms: Record<SocialPlatform, boolean>;
  perPlatform: number;
}

export const SOCIAL_LIMITS = {
  maxPerPlatform: 10,
  maxTopics: 5,
  textChars: 280,
  youtubeApiResults: 12,
  youtubeWindowHours: 48,
} as const;

export const DEFAULT_SOCIAL_PULSE: SocialPulseSettings = {
  enabled: true,
  topics: ["AI"],
  platforms: { youtube: true, x: false, linkedin: false, pinterest: false, instagram: false },
  perPlatform: 5,
};

interface PlatformInfo {
  label: string;
  /** Hosts an item link may point at; subdomains included. */
  linkHosts: string[];
  /** Image CDNs a thumbnail may load from; subdomains included. */
  imageHosts: string[];
  /** Shown beside the toggle in Settings. */
  riskNote: string;
  /** Reads the user's signed-in session, so it is opt-in. */
  signedIn: boolean;
}

export const SOCIAL_PLATFORM_INFO: Record<SocialPlatform, PlatformInfo> = {
  youtube: {
    label: "YouTube",
    linkHosts: ["youtube.com", "youtu.be"],
    imageHosts: ["ytimg.com"],
    riskNote: "Uses the official Data API when a key is set; otherwise reads one search page.",
    signedIn: false,
  },
  x: {
    label: "X",
    linkHosts: ["x.com", "twitter.com"],
    imageHosts: ["pbs.twimg.com"],
    riskNote: "X's terms forbid automated access. Reads one search page per build in your session.",
    signedIn: true,
  },
  linkedin: {
    label: "LinkedIn",
    linkHosts: ["linkedin.com"],
    imageHosts: ["media.licdn.com"],
    riskNote: "LinkedIn restricts automated viewing and may flag your account.",
    signedIn: true,
  },
  pinterest: {
    label: "Pinterest",
    linkHosts: ["pinterest.com"],
    imageHosts: ["i.pinimg.com"],
    riskNote: "Pinterest's terms restrict scraping. Reads one search page per build.",
    signedIn: true,
  },
  instagram: {
    label: "Instagram",
    linkHosts: ["instagram.com"],
    imageHosts: ["cdninstagram.com", "fbcdn.net"],
    riskNote: "Meta's terms forbid automated collection and may limit your account.",
    signedIn: true,
  },
};

/** Split the Settings field into a clean, capped topic list. */
export function parseTopics(input: string | string[]): string[] {
  const parts = (Array.isArray(input) ? input : input.split(","))
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique = parts.filter((t) => !seen.has(t.toLowerCase()) && Boolean(seen.add(t.toLowerCase())));
  return unique.slice(0, SOCIAL_LIMITS.maxTopics);
}

export function clampPerPlatform(n: unknown): number {
  const value = Math.round(Number(n));
  if (!Number.isFinite(value)) return DEFAULT_SOCIAL_PULSE.perPlatform;
  return Math.min(SOCIAL_LIMITS.maxPerPlatform, Math.max(1, value));
}

/**
 * The one page each signed-in adapter may load. Several topics are OR-joined
 * into a single query, because the rule is one page per platform per build.
 */
export function socialSearchUrl(platform: SocialPlatform, topics: string[]): string {
  const q = (joiner: string) => encodeURIComponent(topics.join(joiner));
  switch (platform) {
    case "youtube":
      // sp=CAI%3D sorts by upload date.
      return `https://www.youtube.com/results?search_query=${q(" | ")}&sp=CAI%253D`;
    case "x":
      return `https://x.com/search?q=${q(" OR ")}&src=typed_query&f=live`;
    case "linkedin":
      return `https://www.linkedin.com/search/results/content/?keywords=${q(" OR ")}&sortBy=%22date_posted%22`;
    case "pinterest":
      return `https://www.pinterest.com/search/pins/?q=${q(" ")}`;
    case "instagram": {
      // A tag page takes exactly one tag: the first topic, letters and digits only.
      const tag = (topics[0] ?? "").toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "");
      return `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
    }
  }
}

function hostMatches(host: string, allowed: string[]): boolean {
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** https only, no credentials, no explicit port, host on the list. */
function strictHttps(raw: string, allowed: string[], base?: string): URL | null {
  try {
    const url = new URL(raw, base);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return hostMatches(host, allowed) ? url : null;
  } catch {
    return null;
  }
}

/** A post link the platform's allowlist accepts, or null. */
export function validateItemUrl(platform: SocialPlatform, raw: string, base?: string): string | null {
  const url = strictHttps(raw, SOCIAL_PLATFORM_INFO[platform].linkHosts, base);
  if (!url) return null;
  url.hash = "";
  return url.href;
}

/** A thumbnail on the platform's image CDN, or null (the item survives without it). */
export function validateThumbnailUrl(platform: SocialPlatform, raw: string | null | undefined, base?: string): string | null {
  if (!raw) return null;
  return strictHttps(raw, SOCIAL_PLATFORM_INFO[platform].imageHosts, base)?.href ?? null;
}

/** "mo"/"month" must be checked before the single-letter "m" (minutes). */
function unitMs(unit: string): number {
  if (unit.startsWith("mo")) return 30 * 86_400_000;
  switch (unit[0]) {
    case "s": return 1_000;
    case "m": return 60_000;
    case "h": return 3_600_000;
    case "d": return 86_400_000;
    case "w": return 7 * 86_400_000;
    default: return 365 * 86_400_000;
  }
}

/**
 * Resolve the times platforms print: an ISO stamp, "3h", "3 hours ago",
 * "Streamed 2 days ago", "just now". Returns null when nothing parses.
 */
export function parseRelativeTime(text: string | null | undefined, now: Date): string | null {
  if (!text) return null;
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}t/.test(value)) {
    const t = Date.parse(text.trim());
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  if (/\b(just now|now)\b/.test(value)) return now.toISOString();
  const match = value.match(/(\d+)\s*(mo|months?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|wks?|weeks?|y|yrs?|years?)\b/);
  if (!match) return null;
  return new Date(now.getTime() - Number(match[1]) * unitMs(match[2])).toISOString();
}

export function clipText(text: string | null | undefined): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > SOCIAL_LIMITS.textChars ? `${clean.slice(0, SOCIAL_LIMITS.textChars - 1)}…` : clean;
}

/** Dedupe by URL, drop empty items, newest first (undated last), cap. */
export function finalizeItems(items: SocialItem[], perPlatform: number): SocialItem[] {
  const seen = new Set<string>();
  const kept = items.filter((item) => {
    if (!item.text || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  const time = (item: SocialItem) => (item.publishedAt ? Date.parse(item.publishedAt) : -Infinity);
  return kept.sort((a, b) => time(b) - time(a)).slice(0, perPlatform);
}

export function emptyPlatformReports(status: SocialStatus = "skipped", detail?: string): Record<SocialPlatform, SocialPlatformReport> {
  return Object.fromEntries(
    SOCIAL_PLATFORMS.map((p) => [p, { status, count: 0, ...(detail ? { detail } : {}) }]),
  ) as Record<SocialPlatform, SocialPlatformReport>;
}

const POST_PATHS: Record<SocialPlatform, RegExp> = {
  youtube: /^\/(watch|shorts\/)|^\/[\w-]{11}$/,
  x: /^\/[^/]+\/status\/\d+/,
  linkedin: /^\/(feed\/update|posts)\//,
  pinterest: /^\/pin\/\d+/,
  instagram: /^\/(p|reel)\//,
};

/**
 * Post links in the written homepage that Social Pulse did not supply. Only
 * links shaped like a post on one of the five platforms are checked, so
 * ordinary links from scraped pages pass through.
 */
export function findUnlistedSocialLinks(code: string, items: Pick<SocialItem, "url">[]): string[] {
  const known = new Set(items.map((i) => i.url));
  const found = code.match(/https:\/\/[^\s"'`<>)\\]+/g) ?? [];
  return [...new Set(found)].filter((raw) => {
    if (known.has(raw)) return false;
    return SOCIAL_PLATFORMS.some((p) => {
      const url = strictHttps(raw, SOCIAL_PLATFORM_INFO[p].linkHosts);
      return url !== null && POST_PATHS[p].test(url.pathname);
    });
  });
}
