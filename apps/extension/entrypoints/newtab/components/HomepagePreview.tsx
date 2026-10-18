import serifFont from "../../../assets/fonts/source-serif-4-latin.woff2?inline";
import sansFont from "../../../assets/fonts/source-sans-3-latin.woff2?inline";
import morningBanner from "../../../assets/morning-banner.jpg?inline";
import { NEWSLETTER_CSS } from "@themorningtab/agent-core";
import { SandpackLayout, SandpackPreview, SandpackProvider } from "@codesandbox/sandpack-react";

const INDEX_JS = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./newsletter.css";

// Model-written links don't always set target="_blank". Followed inside this
// iframe, most sites refuse to be framed and show an error, so every web link
// opens in a new tab. In-page anchors are left alone.
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!link) return;
  const href = link.getAttribute("href");
  if (!href || href.startsWith("#")) return;
  let url;
  try { url = new URL(href, location.href); } catch { return; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin === location.origin && url.hash) return;
  event.preventDefault();
  window.open(url.href, "_blank", "noopener,noreferrer");
}, true);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en"><head><title>The Morning Tab</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><div id="root"></div></body></html>`;

/**
 * Renders the agent's component in a Sandpack iframe. The code is
 * model-generated, so it runs sandboxed rather than in the extension's own page.
 */
export function HomepagePreview({ code }: { code: string }) {
  const files = {
    "/App.js": { code },
    "/index.js": { code: INDEX_JS },
    "/public/index.html": { code: INDEX_HTML },
    "/newsletter.css": { code: `
      @font-face { font-family: "Source Serif 4"; src: url("${serifFont}") format("woff2"); font-weight: 400 700; font-style: normal; font-display: swap; }
      @font-face { font-family: "Source Sans 3"; src: url("${sansFont}") format("woff2"); font-weight: 400 700; font-style: normal; font-display: swap; }
      body { margin: 0; } :root { --mt-masthead-art: url("${morningBanner}"); } ${NEWSLETTER_CSS}` },
  };

  return (
    <SandpackProvider files={files} template="react" options={{ autorun: true }}>
      <SandpackLayout style={{ height: "calc(100vh - 64px)", width: "100vw", border: 0, borderRadius: 0 }}>
        <SandpackPreview style={{ height: "100%" }} showOpenInCodeSandbox={false} showRefreshButton={false} />
      </SandpackLayout>
    </SandpackProvider>
  );
}
