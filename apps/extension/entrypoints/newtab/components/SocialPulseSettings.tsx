import {
  SOCIAL_LIMITS,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_INFO,
  type SocialPlatform,
  type SocialStatus,
} from "@themorningtab/agent-core";
import type { SocialPulseStatus } from "@/lib/storage";

/** Settings-form state; topics stay a raw string until save. */
export interface SocialPulseDraft {
  enabled: boolean;
  topics: string;
  platforms: Record<SocialPlatform, boolean>;
  perPlatform: number;
  youtubeApiKey: string;
}

const STATUS_STYLE: Record<SocialStatus, { label: string; color: string; bg: string }> = {
  ok: { label: "ok", color: "#0b6b3a", bg: "#e3f5ea" },
  "signed-out": { label: "signed out", color: "#8a5300", bg: "#fff2d9" },
  blocked: { label: "blocked", color: "#555", bg: "#eee" },
  failed: { label: "failed", color: "#a02620", bg: "#fdeceb" },
  skipped: { label: "skipped", color: "#666", bg: "#f2f2f2" },
};

const label = { display: "block", color: "#333", fontSize: 14 } as const;
const input = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  padding: "8px 10px",
  fontSize: 14,
  borderRadius: 4,
  border: "1px solid #ddd",
} as const;
const note = { color: "#888", fontSize: 12, margin: "4px 0 0" } as const;

export function SocialPulseSettings({
  draft,
  onChange,
  lastStatus,
}: {
  draft: SocialPulseDraft;
  onChange: (next: SocialPulseDraft) => void;
  lastStatus: SocialPulseStatus | null;
}) {
  const set = <K extends keyof SocialPulseDraft>(key: K, value: SocialPulseDraft[K]) => onChange({ ...draft, [key]: value });
  const muted = draft.enabled ? 1 : 0.5;

  return (
    <fieldset style={{ border: "1px solid #e4e4e4", borderRadius: 6, padding: "12px 14px 14px", marginTop: 20, minWidth: 0 }}>
      <legend style={{ padding: "0 6px", color: "#333", fontWeight: 600, fontSize: 14 }}>Social Pulse</legend>
      <label style={{ ...label, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={draft.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        Show the latest posts about my topics
      </label>

      <div style={{ opacity: muted }} aria-disabled={!draft.enabled}>
        <label style={{ ...label, marginTop: 12 }}>
          Topics
          <input
            value={draft.topics}
            disabled={!draft.enabled}
            onChange={(e) => set("topics", e.target.value)}
            placeholder="AI"
            style={input}
          />
        </label>
        <p style={note}>Comma-separated, up to {SOCIAL_LIMITS.maxTopics}. They are combined into one search per platform.</p>

        <div style={{ marginTop: 12 }} role="group" aria-label="Platforms">
          {SOCIAL_PLATFORMS.map((p) => {
            const info = SOCIAL_PLATFORM_INFO[p];
            const status = lastStatus?.platforms[p];
            const badge = status ? STATUS_STYLE[status.status] : null;
            return (
              <div key={p} style={{ padding: "8px 0", borderTop: "1px solid #f0f0f0" }}>
                <label style={{ ...label, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexWrap: "wrap" }}>
                  <input
                    type="checkbox"
                    checked={draft.platforms[p]}
                    disabled={!draft.enabled}
                    onChange={(e) => set("platforms", { ...draft.platforms, [p]: e.target.checked })}
                  />
                  <span style={{ fontWeight: 500 }}>{info.label}</span>
                  {badge && (
                    <span
                      title={status?.detail}
                      style={{ fontSize: 11, padding: "1px 8px", borderRadius: 10, color: badge.color, background: badge.bg }}
                    >
                      {badge.label}
                      {status?.status === "ok" ? ` · ${status.count}` : ""}
                    </span>
                  )}
                </label>
                <p style={{ ...note, marginLeft: 24 }}>
                  {info.riskNote}
                  {status?.detail && status.status !== "ok" ? ` Last build: ${status.detail}.` : ""}
                </p>
              </div>
            );
          })}
        </div>
        {lastStatus && (
          <p style={note}>Status from the build at {new Date(lastStatus.at).toLocaleString()}.</p>
        )}

        <label style={{ ...label, marginTop: 12 }}>
          YouTube API key <span style={{ color: "#888", fontWeight: 400 }}>(optional)</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft.youtubeApiKey}
            disabled={!draft.enabled}
            onChange={(e) => set("youtubeApiKey", e.target.value)}
            placeholder="AIza…"
            style={{ ...input, fontFamily: "ui-monospace, monospace" }}
          />
        </label>
        <p style={note}>
          Uses the official Data API instead of reading the search page.{" "}
          <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
            Enable the API
          </a>
          , then{" "}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            create a key
          </a>
          . Stored on this machine and sent only to Google.
        </p>

        <label style={{ ...label, marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          Items per platform
          <input
            type="number"
            min={1}
            max={SOCIAL_LIMITS.maxPerPlatform}
            value={draft.perPlatform}
            disabled={!draft.enabled}
            onChange={(e) => set("perPlatform", Number(e.target.value))}
            style={{ ...input, width: 72, marginTop: 0 }}
          />
        </label>
      </div>
    </fieldset>
  );
}
