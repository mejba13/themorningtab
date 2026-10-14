import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "The Morning Tab",
    short_name: "Morning Tab",
    description: "All the news that fits your history. A new-tab front page an agent rebuilds daily from what you've actually been browsing.",
    homepage_url: "https://themorningtab.ai",
    permissions: [
      "history", //       getHistory tool
      "tabs", //          getPageHtml: open pages and watch them load
      "scripting", //     getPageHtml: inject the scraper into loaded pages
      "storage", //       API key, settings, the built homepage
      "alarms", //        heartbeat: scheduled rebuilds + reattach after a worker kill
      "notifications", // surface a failed headless rebuild when no tab is open
    ],
    // Needed to scrape arbitrary pages; also exempts api.anthropic.com from CORS.
    host_permissions: ["<all_urls>"],
  },
});
