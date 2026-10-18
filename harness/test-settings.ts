/** Built-extension settings checks. Uses an isolated profile and never starts a paid API run. */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { MODEL_CHOICES, SOCIAL_LIMITS } from "@themorningtab/agent-core";
import { DEFAULT_SYSTEM_PROMPT } from "../apps/extension/lib/default-prompt";

const extension = join(import.meta.dir, "../apps/extension/.output/chrome-mv3");
const executablePath = process.env.CHROMIUM_PATH ?? join(homedir(), "Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const output = "/tmp/morningtab-settings";
if (!existsSync(join(extension, "manifest.json"))) throw new Error("Run pnpm build first.");
mkdirSync(output, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "mt-settings-"));
let failures = 0;
function check(label: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!passed) failures++;
}
const context = await chromium.launchPersistentContext(profile, {
  executablePath, headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  // Service-worker requests cannot rely on page routing. Save tests remove the
  // fake key before triggering a rebuild, exercising the worker's no-key guard.
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:/.test(url)) return route.abort("blockedbyclient");
    return route.continue();
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const url = `chrome-extension://${new URL(worker.url()).host}/newtab.html`;
  async function store(values: Record<string, unknown>) {
    await worker.evaluate(async (values) => { await (globalThis as any).chrome.storage.local.set(values); }, values);
  }
  async function read() {
    return worker.evaluate(async () => (globalThis as any).chrome.storage.local.get(null)) as Promise<Record<string, any>>;
  }
  const homepage = { code: 'export default function Homepage() { return <main>The Morning Tab fixture</main>; }', timestamp: new Date().toISOString() };
  await store({ apiKey: "sk-ant-fixture-not-a-real-key", autoRebuild: false, homepageData: homepage });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    // The blocked remote homepage bundler is outside this isolated modal check.
    if (message.type() === "error" && !/ERR_BLOCKED_BY_CLIENT|Failed to load resource|Sandpack|sandpack|codesandbox/i.test(message.text())) errors.push(message.text());
  });
  async function open() {
    await page.goto(url);
    await page.getByTitle("Customize The Morning Tab").click();
    await page.locator("dialog:modal").waitFor();
  }
  const prompt = page.getByRole("textbox", { name: "Standing instructions applied to every build.", exact: true });
  const save = page.getByRole("button", { name: "Save & rebuild" });
  await open();
  check("new install shows exact newspaper default", await prompt.inputValue() === DEFAULT_SYSTEM_PROMPT);
  check("prompt receives initial focus", await prompt.evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  check("Escape closes dialog", await page.getByRole("dialog").count() === 0);
  check("focus returns to settings trigger", await page.getByTitle("Customize The Morning Tab").evaluate((el) => el === document.activeElement));
  await page.getByTitle("Customize The Morning Tab").click();
  await page.locator("dialog:modal").waitFor();
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press("Tab");
    check(`focus remains in dialog ${i + 1}`, await page.evaluate(() => !!document.activeElement?.closest("dialog")));
  }
  await page.getByRole("button", { name: "Close settings", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  check("reverse Tab wraps to save action", await save.evaluate((el) => el === document.activeElement));
  await page.mouse.click(1, 1);
  await page.getByRole("dialog").waitFor({ state: "detached" });
  check("backdrop dismisses modal and restores focus", await page.getByTitle("Customize The Morning Tab").evaluate((el) => el === document.activeElement));
  await page.getByTitle("Customize The Morning Tab").click();
  await page.locator("dialog:modal").waitFor();
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "tablet", width: 1024, height: 768 }, { name: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const section of ["top", "social"]) {
      if (section === "top") await prompt.scrollIntoViewIfNeeded();
      else await page.getByLabel("Items per platform").scrollIntoViewIfNeeded();
      const bounds = await page.getByRole("dialog").evaluate((dialog) => {
        const rect = dialog.getBoundingClientRect();
        const scroll = dialog.querySelector(".settings-scroll")!;
        const footer = dialog.querySelector(".settings-footer")!.getBoundingClientRect();
        return { fits: rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1, overflow: scroll.scrollWidth > scroll.clientWidth + 1, footer: footer.top >= 0 && footer.bottom <= innerHeight };
      });
      check(`${viewport.name} ${section}: no overflow and visible footer`, bounds.fits && !bounds.overflow && bounds.footer, JSON.stringify(bounds));
      check(`${viewport.name} ${section}: save button visible`, await save.isVisible());
      await page.screenshot({ path: join(output, `${viewport.name}-${section}.png`) });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  check("reduced motion disables all modal animations", await page.getByRole("dialog").evaluate((dialog) => [dialog, ...dialog.querySelectorAll("*")].every((el) => getComputedStyle(el).animationName === "none")));
  check("rebuild interval disabled when automatic rebuild off", await page.locator(".settings-interval select").isDisabled());
  check("social settings disabled by default", await page.getByLabel("Topics", { exact: true }).isDisabled() && await page.getByLabel("Items per platform").isDisabled());
  await page.getByLabel("Rebuild automatically").check();
  await page.locator(".settings-interval select").selectOption("24");
  await page.getByLabel("Rebuild automatically").uncheck();
  const model = MODEL_CHOICES.find((choice) => choice.id !== MODEL_CHOICES[0].id) ?? MODEL_CHOICES[0];
  await page.locator(".settings-model select").selectOption(model.id);
  await prompt.fill("Discard this unsaved draft");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await open();
  check("cancel discards prompt draft", await prompt.inputValue() === DEFAULT_SYSTEM_PROMPT);
  const immediate = await read();
  check("model and schedule survive cancel", immediate.model === model.id && immediate.autoRebuild === false && immediate.autoRebuildIntervalHours === 24);
  await prompt.fill("  My custom daily brief\nOnly reliable AI news.  ");
  await page.getByLabel("Sites the agent never reads").fill("https://EXAMPLE.com/path\nexample.com\n*.private.example");
  await page.getByLabel("Show the latest posts about my topics").check();
  await page.getByLabel("Topics", { exact: true }).fill(" AI, AI, Laravel, MCP ");
  await page.getByLabel("X", { exact: true }).uncheck();
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.getByLabel("Topics", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(output, `${viewport.name}-social-enabled.png`) });
  }
  await page.getByLabel("Items per platform").fill("999");
  await page.getByPlaceholder("AIza…").fill("  fixture-youtube-key  ");
  check("YouTube API field stays masked", await page.getByPlaceholder("AIza…").getAttribute("type") === "password");
  await worker.evaluate(async () => { await (globalThis as any).chrome.storage.local.remove("apiKey"); });
  await save.click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const saved = await read();
  check("save persists custom prompt verbatim and configured marker", saved.systemPrompt === "  My custom daily brief\nOnly reliable AI news.  " && saved.systemPromptConfigured === true);
  check("save normalizes block list", JSON.stringify(saved.blockedSites) === JSON.stringify(["example.com", "*.private.example"]), JSON.stringify(saved.blockedSites));
  check("platform choice persists", saved.socialPulse.platforms.x === false);
  check("save normalizes social inputs", JSON.stringify(saved.socialPulse.topics) === JSON.stringify(["AI", "Laravel", "MCP"]) && saved.socialPulse.perPlatform === SOCIAL_LIMITS.maxPerPlatform && saved.youtubeApiKey === "fixture-youtube-key");
  await page.getByText("No Anthropic API key found. Add your key and try again.").waitFor();
  check("save rebuild safely stops at no-key guard", true);
  await store({ apiKey: "sk-ant-fixture-not-a-real-key", homepageData: homepage });
  await open();
  check("custom prompt survives reload", await prompt.inputValue() === saved.systemPrompt);
  await prompt.fill("");
  await page.getByPlaceholder("AIza…").fill("");
  await worker.evaluate(async () => { await (globalThis as any).chrome.storage.local.remove("apiKey"); });
  await save.click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await store({ apiKey: "sk-ant-fixture-not-a-real-key", homepageData: homepage });
  await open();
  check("cleared YouTube key is removed", !("youtubeApiKey" in await read()));
  check("intentionally cleared prompt stays blank after reload", await prompt.inputValue() === "");
  check("no application console errors", errors.length === 0, errors.join(" | "));
} finally {
  await context.close();
  rmSync(profile, { recursive: true, force: true });
}
console.log(`Settings verification: ${failures} failures. Screenshots: ${output}`);
process.exit(failures ? 1 : 0);
