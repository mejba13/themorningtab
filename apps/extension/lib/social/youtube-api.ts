import { SOCIAL_LIMITS, parseYouTubeApi, type SocialItem } from "@themorningtab/agent-core";

const ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
/** Partial response: only what an item needs. search.list costs 100 units either way; this trims the payload. */
const FIELDS = "items(id/videoId,snippet(publishedAt,title,channelTitle,thumbnails/medium/url))";

/**
 * Newest videos for the topics in the last 48 hours. Errors carry the HTTP
 * status only: the request URL holds the key, so it never goes into a message.
 */
export async function searchYouTube(apiKey: string, topics: string[], now: Date): Promise<SocialItem[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    order: "date",
    // `|` is YouTube's OR, so several topics stay one call.
    q: topics.join("|"),
    publishedAfter: new Date(now.getTime() - SOCIAL_LIMITS.youtubeWindowHours * 3_600_000).toISOString(),
    maxResults: String(SOCIAL_LIMITS.youtubeApiResults),
    fields: FIELDS,
    key: apiKey,
  });

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?${params}`, { credentials: "omit", referrerPolicy: "no-referrer" });
  } catch {
    throw new Error("could not reach the YouTube API");
  }
  if (!response.ok) {
    const hint = response.status === 403 ? " (quota exceeded or key not allowed for YouTube Data API v3)" : response.status === 400 ? " (key invalid?)" : "";
    throw new Error(`YouTube API returned HTTP ${response.status}${hint}`);
  }
  return parseYouTubeApi(await response.json(), { query: topics.join(" OR "), now });
}
