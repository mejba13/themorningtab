/**
 * Renders a Social Pulse homepage from fixture data inside the built extension
 * and checks it at desktop, tablet and mobile widths, in light and dark.
 *
 * No platform is contacted: thumbnail CDNs are answered with local placeholder
 * images, and platform pages and the Anthropic API are aborted. Clicking a card
 * proves where it goes without loading it. Sandpack still needs its CodeSandbox
 * bundler, so this needs a network connection.
 *
 * Run: pnpm build && pnpm extension:social-visual
 * Set CHROMIUM_PATH to a Chromium or Chrome for Testing binary (branded Chrome
 * 136+ ignores --load-extension).
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Frame, type Page } from "playwright-core";
import { SOCIAL_PLATFORM_INFO, type SocialPlatform } from "@themorningtab/agent-core";
import { fixtureHomepage, fixturePulse } from "./social-fixtures";

const EXT = join(import.meta.dir, "../apps/extension/.output/chrome-mv3");
const OUT = join(import.meta.dir, "../docs/social-pulse");
const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  join(homedir(), "Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

if (!existsSync(join(EXT, "manifest.json"))) throw new Error(`No build at ${EXT}. Run: pnpm build`);
if (!existsSync(CHROMIUM)) throw new Error(`No Chromium at ${CHROMIUM}. Set CHROMIUM_PATH.`);
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (label: string, pass: boolean, extra?: string) => {
  console.log(`${pass ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!pass) failures++;
};

const IMAGE_HOSTS = Object.values(SOCIAL_PLATFORM_INFO).flatMap((p) => p.imageHosts);
const LINK_HOSTS = Object.values(SOCIAL_PLATFORM_INFO).flatMap((p) => p.linkHosts);
const onHosts = (url: string, hosts: string[]) => {
  const host = new URL(url).hostname;
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
};

/** A stand-in thumbnail, tinted per CDN so the screenshots stay readable. */
function placeholder(url: string): string {
  const host = new URL(url).hostname;
  const hue = [...host].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,35%)"/></linearGradient></defs>
    <rect width="320" height="180" fill="url(#g)"/><text x="16" y="164" font-family="system-ui" font-size="13" fill="#fff" opacity=".85">${host}</text></svg>`;
}

const pulse = await fixturePulse();
const code = fixtureHomepage(pulse);
const profile = mkdtempSync(join(tmpdir(), "mt-visual-"));
const blockedRequests: string[] = [];

const context: BrowserContext = await chromium.launchPersistentContext(profile, {
  executablePath: CHROMIUM,
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith("http")) return route.continue();
    if (onHosts(url, IMAGE_HOSTS)) return route.fulfill({ contentType: "image/svg+xml", body: placeholder(url) });
    if (onHosts(url, [...LINK_HOSTS, "anthropic.com", "googleapis.com"])) {
      blockedRequests.push(url);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const extId = new URL(worker.url()).host;
  console.log(`   extension id: ${extId}\n`);

  // A saved homepage and settings, as after a successful build. Auto-rebuild off
  // and a fresh timestamp, so the fake key never starts a real build.
  await worker.evaluate(
    async ({ code, pulse }) => {
      await (globalThis as any).chrome.storage.local.set({
        apiKey: "sk-ant-fixture-not-a-real-key",
        autoRebuild: false,
        homepageData: { code, timestamp: new Date().toISOString() },
        socialPulse: { enabled: true, topics: ["AI"], platforms: { youtube: true, x: true, linkedin: true, pinterest: true, instagram: true }, perPlatform: 5 },
        socialPulseStatus: { at: pulse.generatedAt, platforms: { ...pulse.platforms, instagram: { status: "signed-out", detail: "sign in to this site in Chrome", count: 0 } } },
      });
    },
    { code, pulse },
  );

  const NEWTAB = `chrome-extension://${extId}/newtab.html`;

  async function openHomepage(page: Page): Promise<Frame> {
    await page.goto(NEWTAB);
    const handle = await page.waitForSelector("iframe", { timeout: 60_000 });
    const frame = (await handle.contentFrame())!;
    await frame.waitForSelector("text=Social Pulse", { timeout: 90_000 });
    // Thumbnails are lazy: bring each into view once so it loads, then return to the top.
    await frame.evaluate(async () => {
      for (const img of [...document.images]) {
        img.scrollIntoView({ block: "center" });
        await new Promise((r) => setTimeout(r, 30));
      }
      window.scrollTo(0, 0);
    });
    await frame.waitForFunction(() => [...document.images].every((img) => img.complete), undefined, { timeout: 20_000 });
    return frame;
  }

  for (const scheme of ["light", "dark"] as const) {
    for (const vp of VIEWPORTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.emulateMedia({ colorScheme: scheme });
      const problems: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" || /Content Security Policy|Refused to/i.test(msg.text())) problems.push(msg.text());
      });
      page.on("pageerror", (err) => problems.push(String(err)));

      const frame = await openHomepage(page);
      const label = `${vp.name} ${vp.width}x${vp.height} ${scheme}`;
      const stats = await frame.evaluate(() => {
        const imgs = [...document.images];
        const cards = [...document.querySelectorAll<HTMLAnchorElement>("a.card")];
        const doc = document.documentElement;
        const overflowing = [...document.querySelectorAll<HTMLElement>("main *")].filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1).length;
        return {
          images: imgs.length,
          broken: imgs.filter((i) => !i.naturalWidth).length,
          cards: cards.length,
          hrefs: cards.map((a) => a.href),
          // The heading's own text, without the decorative icon.
          groups: [...document.querySelectorAll("h2.group")].map((h) =>
            [...h.childNodes].filter((n) => !(n instanceof Element && n.classList.contains("mark"))).map((n) => n.textContent).join("").trim(),
          ),
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          overflowing,
          bg: getComputedStyle(document.body).backgroundColor,
        };
      });

      check(`${label}: thumbnails load`, stats.images > 0 && stats.broken === 0, `${stats.images - stats.broken}/${stats.images}`);
      check(`${label}: no horizontal overflow`, stats.scrollWidth <= stats.clientWidth && stats.overflowing === 0, `${stats.scrollWidth}px in ${stats.clientWidth}px, ${stats.overflowing} element(s) past the edge`);
      const expectedGroups = Object.keys(pulse.platforms).map((p) => SOCIAL_PLATFORM_INFO[p as SocialPlatform].label);
      check(`${label}: platform labels`, JSON.stringify(stats.groups) === JSON.stringify(expectedGroups), stats.groups.join(" | "));
      check(`${label}: every card links to a tool-output URL`, stats.cards === pulse.items.length && stats.hrefs.every((h) => pulse.items.some((i) => i.url === h)), `${stats.cards} cards`);
      const dark = stats.bg === "rgb(14, 17, 22)";
      check(`${label}: ${scheme} theme applied`, scheme === "dark" ? dark : !dark, stats.bg);
      check(`${label}: no console errors or CSP violations`, problems.length === 0, problems.slice(0, 2).join(" / "));

      await page.screenshot({ path: join(OUT, `${vp.name}-${scheme}.png`) });
      await page.close();
    }
  }

  // Clicking opens the item's own URL (the request is caught and aborted).
  {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    const frame = await openHomepage(page);
    for (const platform of ["youtube", "x", "linkedin", "pinterest", "instagram"] as const) {
      const card = frame.locator(`a.card[data-platform="${platform}"]`).first();
      const expected = (await card.getAttribute("href"))!;
      const before = blockedRequests.length;
      // The new tab's navigation hits the route above, which records and aborts it.
      // Headless Chrome intermittently drops a click into the cross-origin
      // iframe; one retry is allowed and reported, so a real failure still fails.
      let attempts = 0;
      while (blockedRequests.length === before && attempts < 2) {
        attempts++;
        await card.click();
        const deadline = Date.now() + 5_000;
        while (blockedRequests.length === before && Date.now() < deadline) await page.waitForTimeout(100);
      }
      const opened = blockedRequests[before] ?? "(nothing opened)";
      check(`click ${platform} card opens its URL`, opened === expected, `${opened}${attempts > 1 ? " (needed a second click)" : ""}`);
      for (const extra of context.pages()) if (extra !== page) await extra.close();
    }

    // Regression: a link without target="_blank" must open a new tab, not
    // navigate the homepage iframe onto a site that refuses to be framed.
    {
      const url = "https://www.linkedin.com/feed/update/urn:li:activity:1/";
      await frame.evaluate((href) => {
        const a = Object.assign(document.createElement("a"), { href, id: "no-target", textContent: "no target" });
        document.querySelector("main")!.prepend(a);
      }, url);
      const before = blockedRequests.length;
      const frameUrl = frame.url();
      await frame.click("#no-target");
      const deadline = Date.now() + 10_000;
      while (blockedRequests.length === before && Date.now() < deadline) await page.waitForTimeout(100);
      const popups = context.pages().filter((p) => p !== page).length;
      check("link without a target opens a new tab", blockedRequests[before] === url && popups > 0 && frame.url() === frameUrl, `${popups} new tab(s), frame ${frame.url() === frameUrl ? "stayed" : "navigated"}`);
      for (const extra of context.pages()) if (extra !== page) await extra.close();
    }

    // Settings panel with the last-build status badges.
    await page.goto(NEWTAB);
    await page.getByTitle("Customize The Morning Tab").click();
    const panel = page.locator("fieldset", { hasText: "Social Pulse" });
    await panel.waitFor();
    const text = await panel.innerText();
    check("settings: panel shows per-platform status", /ok · \d/.test(text) && text.includes("signed out"), text.split("\n").filter((l) => /ok ·|signed out/.test(l)).join(" | "));
    check("settings: risk note beside each toggle", Object.values(SOCIAL_PLATFORM_INFO).every((p) => text.includes(p.riskNote)));
    const keyType = await panel.locator('input[placeholder="AIza…"]').getAttribute("type");
    check("settings: YouTube key field is masked", keyType === "password");
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, "settings-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    const sheet = await page.evaluate(() => {
      const box = document.querySelector("fieldset")!.getBoundingClientRect();
      return { right: box.right, width: document.documentElement.clientWidth };
    });
    check("settings: panel fits at 390px", sheet.right <= sheet.width, `${Math.round(sheet.right)}px of ${sheet.width}px`);
    await page.screenshot({ path: join(OUT, "settings-mobile.png") });
    await page.close();
  }

  const leaked = blockedRequests.filter((u) => !/\/(watch|shorts|status|feed\/update|pin|p|reel)\b/.test(new URL(u).pathname));
  check("no platform page or API was loaded except the clicked cards", leaked.length === 0, leaked.slice(0, 3).join(", "));
} finally {
  await context.close();
  rmSync(profile, { recursive: true, force: true });
}

console.log(failures ? `\n\x1b[31m${failures} CHECK(S) FAILED\x1b[0m` : `\n\x1b[32mSOCIAL PULSE VISUAL VERIFIED\x1b[0m — screenshots in docs/social-pulse/`);
process.exit(failures ? 1 : 0);
