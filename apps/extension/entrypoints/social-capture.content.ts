/**
 * Injected on demand by lib/social/capture.ts (never auto-registered). Unlike
 * the page scraper it does not scroll, click or type: it reads the page as it
 * rendered and returns its markup without scripts, styles or inline SVG.
 */
export default defineContentScript({
  registration: "runtime",
  main() {
    const root = document.documentElement.cloneNode(true) as HTMLElement;
    root.querySelectorAll("script, style, noscript, svg, link, iframe").forEach((el) => el.remove());
    return { url: location.href, html: root.outerHTML };
  },
});
