/**
 * Social Pulse fixtures shared by the unit tests and the visual check. The HTML
 * is synthetic, modelled on each site's rendered markup; no live platform page
 * is ever loaded.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import React from "react";
import { renderToString } from "react-dom/server";
import { transform } from "sucrase";
import {
  DEFAULT_SOCIAL_PULSE,
  SOCIAL_PLATFORMS,
  collectSocialPulse,
  parseYouTubeApi,
  type SocialPlatform,
  type SocialPulseDeps,
  type SocialPulseResult,
} from "@themorningtab/agent-core";

export const FIXTURE_DIR = join(import.meta.dir, "fixtures/social");
export const FIXTURE_NOW = new Date("2026-10-15T12:00:00Z");

export const fixture = (name: string) => readFileSync(join(FIXTURE_DIR, name), "utf-8");
export const fixtureDoc = (name: string) => parseHTML(fixture(name)).document as unknown as ParentNode;

/** Which fixture each platform's search page returns, and where it "landed". */
export const OK_PAGES: Record<SocialPlatform, { file: string; finalUrl?: string }> = {
  youtube: { file: "youtube-search.html" },
  x: { file: "x-search.html" },
  linkedin: { file: "linkedin-search.html" },
  pinterest: { file: "pinterest-search.html" },
  instagram: { file: "instagram-tag.html" },
};

const platformOf = (url: string): SocialPlatform => {
  const host = new URL(url).hostname;
  return SOCIAL_PLATFORMS.find((p) => host.includes(p === "x" ? "x.com" : p))!;
};

export function fixtureDeps(overrides: Partial<SocialPulseDeps> & {
  pages?: Partial<Record<SocialPlatform, { file: string; finalUrl?: string } | Error>>;
} = {}): SocialPulseDeps & { captured: string[]; sleeps: number[] } {
  const captured: string[] = [];
  const sleeps: number[] = [];
  const pages = { ...OK_PAGES, ...overrides.pages };
  return {
    settings: { ...DEFAULT_SOCIAL_PULSE, enabled: true, platforms: { youtube: true, x: true, linkedin: true, pinterest: true, instagram: true } },
    blockedSites: [],
    now: FIXTURE_NOW,
    parseHtml: (html) => parseHTML(html).document as unknown as ParentNode,
    capture: async (url) => {
      captured.push(url);
      const page = pages[platformOf(url)]!;
      if (page instanceof Error) throw page;
      return { finalUrl: page.finalUrl ?? url, html: fixture(page.file) };
    },
    sleep: async (ms) => void sleeps.push(ms),
    random: () => 0.5,
    ...overrides,
    captured,
    sleeps,
  };
}

/** Every platform on, YouTube through the (fixture) API: the richest result. */
export function fixturePulse(): Promise<SocialPulseResult> {
  return collectSocialPulse(
    fixtureDeps({
      youtubeApiKey: "test-key",
      searchYouTube: async (_key, topics, now) =>
        parseYouTubeApi(JSON.parse(fixture("youtube-api.json")), { query: topics.join(" OR "), now }),
    }),
  );
}

/** A homepage the way the agent would write one, with the fixture pulse inlined. */
export function fixtureHomepage(pulse: SocialPulseResult): string {
  return fixture("homepage.tsx")
    .replace("/*__PULSE__*/ null", JSON.stringify(pulse))
    .replace("/*__NOW__*/ null", JSON.stringify(FIXTURE_NOW.toISOString()));
}

/** Transform and server-render a homepage the way agent:verify does, React as the only import. */
export function renderHomepage(tsx: string): string {
  const js = transform(tsx, { transforms: ["typescript", "jsx", "imports"], jsxRuntime: "classic" }).code;
  const mod = { exports: {} as Record<string, unknown> };
  const req = (name: string) => {
    if (name === "react") return React;
    throw new Error(`homepage imported ${name}`);
  };
  new Function("require", "module", "exports", "React", js)(req, mod, mod.exports, React);
  return renderToString(React.createElement(mod.exports.default as React.FC));
}
