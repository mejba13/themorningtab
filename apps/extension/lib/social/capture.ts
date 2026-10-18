import { createScraperWindow, waitForTabLoad, withTimeout } from "../scraper";

const LOAD_TIMEOUT_MS = 30_000;
/** Feeds render client-side after `complete`; give them a moment, then read once. */
const SETTLE_MS = 6_000;
const INJECT_TIMEOUT_MS = 30_000;

export interface Capture {
  finalUrl: string;
  html: string;
}

/**
 * One window for every platform in a build, created on first use. Each page is
 * opened in a background tab, read once without interaction, and closed.
 */
export class CaptureWindow {
  private windowId: number | null = null;

  async capture(url: string): Promise<Capture> {
    this.windowId ??= await createScraperWindow();
    const tab = await browser.tabs.create({ url, active: false, windowId: this.windowId });
    try {
      if (!(await waitForTabLoad(tab.id!, LOAD_TIMEOUT_MS))) throw new Error("timed out loading the page");
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const [injection] = await withTimeout(
        browser.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ["/content-scripts/social-capture.js"],
        }),
        INJECT_TIMEOUT_MS,
        "reading the page",
      );
      const result = injection?.result as { url?: string; html?: string } | undefined;
      if (!result?.html) throw new Error("the page returned no content");
      return { finalUrl: result.url ?? url, html: result.html };
    } finally {
      await browser.tabs.remove(tab.id!).catch(() => {});
    }
  }

  async close() {
    if (this.windowId === null) return;
    await browser.windows.remove(this.windowId).catch(() => {});
    this.windowId = null;
  }
}
