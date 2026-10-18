import { collectSocialPulse, type SocialPulseResult } from "@themorningtab/agent-core";
import { parseHTML } from "linkedom";
import { rebuildIntervalMs } from "../auto-rebuild";
import { KEYS, extensionStore, loadSettings, type SocialPulseStatus, type YouTubeCache } from "../storage";
import { CaptureWindow } from "./capture";
import { searchYouTube } from "./youtube-api";

/** Social Pulse over chrome.tabs, linkedom and the YouTube API. Records each platform's outcome for Settings. */
export async function runSocialPulse({ blockedSites }: { blockedSites: string[] }): Promise<SocialPulseResult> {
  const settings = await loadSettings();
  const ttl = rebuildIntervalMs(settings.rebuildIntervalHours);
  const window = new CaptureWindow();
  try {
    const result = await collectSocialPulse({
      settings: settings.socialPulse,
      blockedSites,
      youtubeApiKey: settings.youtubeApiKey,
      now: new Date(),
      capture: (url) => window.capture(url),
      parseHtml: (html) => parseHTML(html).document,
      searchYouTube,
      readYouTubeCache: async (signature) => {
        const cache = await extensionStore.get<YouTubeCache>(KEYS.youtubeCache);
        if (!cache || cache.signature !== signature) return undefined;
        return Date.now() - Date.parse(cache.fetchedAt) < ttl ? cache.items : undefined;
      },
      writeYouTubeCache: (signature, items) =>
        extensionStore.set(KEYS.youtubeCache, { signature, fetchedAt: new Date().toISOString(), items } satisfies YouTubeCache),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    await extensionStore.set(KEYS.socialPulseStatus, { at: result.generatedAt, platforms: result.platforms } satisfies SocialPulseStatus);
    return result;
  } finally {
    await window.close();
  }
}
