import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [{
      name: "anthropic-browser-credentials",
      enforce: "pre",
      transform(code, id) {
        // SDK 0.110 includes optional disk credentials in its browser client.
        // Chrome uses an explicit API key; reject disk access rather than ship Node imports.
        if (!id.includes("/@anthropic-ai/sdk/") || !/\/(?:core|lib)\/credentials(?:\/|\.)/.test(id)) return;
        const browserCode = code.replace(/import\(['"](node:fs|node:path)['"]\)/g, (_, module: string) =>
          `Promise.reject(new Error(${JSON.stringify(`${module} is unavailable in the extension. Use an explicit API key.`)}))`,
        );
        if (browserCode !== code) return { code: browserCode, map: null };
      },
    }],
  }),
  hooks: {
    "vite:build:extendConfig"(entrypoints, config) {
      if (!entrypoints.some((entry) => entry.type === "background" || entry.type === "newtab")) return;
      config.build ??= {};
      config.build.rolldownOptions ??= {};
      config.build.rolldownOptions.output = {
        ...config.build.rolldownOptions.output,
        codeSplitting: {
          groups: [
            { name: "react", test: /\/(?:react|react-dom|scheduler)\//, priority: 40 },
            { name: "compiler", test: /\/sucrase\//, priority: 30 },
            { name: "editor", test: /\/(?:@codemirror|@lezer)\//, priority: 25 },
            { name: "anthropic", test: /\/@anthropic-ai\/sdk\//, priority: 20 },
            { name: "preview-client", test: /\/@codesandbox\/sandpack-client\//, priority: 15 },
            { name: "preview", test: /\/@codesandbox\//, priority: 10 },
          ],
        },
      };
    },
  },
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
