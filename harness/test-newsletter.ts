import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { newsletterFixture } from "./newsletter-fixture";

const extension = join(import.meta.dir, "../apps/extension/.output/chrome-mv3");
const profile = mkdtempSync(join(tmpdir(), "mt-newsletter-"));
const output = "/tmp/morningtab-newsletter";
mkdirSync(output, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROMIUM_PATH ?? join(homedir(), "Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
  headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  await context.route("https://example.org/**", route => route.fulfill({ contentType: "text/html", body: "<title>Link target fixture</title>Destination reached" }));
  await context.route("https://api.anthropic.com/**", route => route.abort());
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  await worker.evaluate(async code => {
    await (globalThis as any).chrome.storage.local.set({ apiKey: "fixture-not-real", autoRebuild: false, homepageData: { code, timestamp: new Date().toISOString() } });
  }, newsletterFixture);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/newtab.html`);
  const iframe = await page.waitForSelector("iframe", { timeout: 60000 });
  const frame = (await iframe.contentFrame())!;
  await frame.waitForSelector(".mt-edition", { timeout: 90000 });
  const typography = await frame.evaluate(async () => {
    await Promise.all([
      document.fonts.load('600 22px "Source Serif 4"'),
      document.fonts.load('400 16px "Source Serif 4"'),
      document.fonts.load('700 18px "Source Sans 3"'),
    ]);
    await document.fonts.ready;
    const family = (selector: string) => getComputedStyle(document.querySelector(selector)!).fontFamily;
    return {
      loaded: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family),
      headline: family(".mt-story h2"), body: family(".mt-story p"),
      section: family(".mt-section > h2"), metadata: family(".mt-meta"),
    };
  });
  assert.ok(typography.loaded.includes("Source Serif 4") && typography.loaded.includes("Source Sans 3"));
  assert.ok(typography.headline.includes("Source Serif 4") && typography.body.includes("Source Serif 4"));
  assert.ok(typography.section.includes("Source Sans 3") && typography.metadata.includes("Source Sans 3"));
  console.log("PASS locally loaded editorial fonts", typography);
  const banner = await frame.evaluate(async () => {
    const header = document.querySelector(".mt-masthead")!;
    const background = getComputedStyle(header).backgroundImage;
    const url = background.slice(5, -2);
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, local: url.startsWith("data:image/") };
  });
  assert.ok(banner.local && banner.width >= 1600 && banner.height > 0, "bundled banner decodes without a remote image request");
  console.log("PASS bundled header banner", banner);
  for (const scheme of ["light", "dark"] as const) {
    for (const [name, width, height] of [["desktop", 1440, 1000], ["tablet", 820, 1180], ["mobile", 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: scheme });
      const stats = await frame.evaluate(() => {
        const edition = document.querySelector(".mt-edition")!;
        const grid = document.querySelector(".mt-grid")!;
        const styles = getComputedStyle(edition);
        const luminance = (hex: string) => {
          const digits = hex.trim().replace("#", "");
          const full = digits.length === 3 ? [...digits].map(c => c + c).join("") : digits;
          const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
            .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const paper = luminance(styles.getPropertyValue("--paper"));
        const contrast = ["--ink", "--muted", "--accent", "--alert"].map(token => {
          const ink = luminance(styles.getPropertyValue(token));
          return (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05);
        });
        return { contrast, width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
          bg: getComputedStyle(edition).backgroundColor, columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length };
      });
      assert.ok(stats.contrast.every(ratio => ratio >= 4.5), "WCAG AA text contrast");
      assert.ok(stats.scroll <= stats.width, `${name}: horizontal overflow`);
      assert.equal(stats.columns, width <= 700 ? 1 : 2);
      assert.equal(stats.bg, scheme === "dark" ? "rgb(20, 26, 34)" : "rgb(255, 255, 255)");
      await frame.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(output, `${name}-${scheme}.png`) });
      await frame.locator(".mt-ideas").scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(output, `${name}-${scheme}-footer.png`) });
      console.log("PASS", name, scheme, stats);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await frame.locator('a[href="#security"]').click();
  assert.ok(frame.url().endsWith("#security"), "section navigation stays in frame");
  await page.keyboard.press("Tab");
  const links = frame.locator('a[href^="https:"]');
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const href = await link.getAttribute("href");
    // Keyboard activation avoids cross-origin frame pointer flakiness and proves accessibility.
    await link.focus();
    assert.equal(await link.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
    const opened = context.waitForEvent("page", { timeout: 10000 });
    await page.keyboard.press("Enter");
    const popup = await opened;
    await popup.waitForURL(href!);
    assert.equal(await popup.evaluate(() => window.opener), null);
    await popup.close();
  }
  // Also exercise an actual pointer click on a headline.
  const popupPromise = context.waitForEvent("page", { timeout: 10000 });
  await frame.locator(".mt-lead h2 a").click();
  const popup = await popupPromise;
  await popup.waitForURL("https://example.org/lead");
  await popup.close();
  assert.deepEqual(errors, []);
  console.log(`PASS all ${count} external links, pointer click, section navigation, focus, and console. Screenshots: ${output}`);
} finally {
  await context.close();
  rmSync(profile, { recursive: true, force: true });
}
