import { SandpackLayout, SandpackPreview, SandpackProvider } from "@codesandbox/sandpack-react";

const INDEX_JS = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Model-written links don't always set target="_blank". Followed inside this
// iframe, most sites refuse to be framed and show an error, so every web link
// opens in a new tab. In-page anchors are left alone.
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!link) return;
  const url = new URL(link.getAttribute("href"), location.href);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin === location.origin && url.hash) return;
  event.preventDefault();
  window.open(url.href, "_blank", "noopener,noreferrer");
}, true);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);`;

const INDEX_HTML = `<!DOCTYPE html>
<html><head><title>The Morning Tab</title></head>
<body><div id="root"></div></body></html>`;

/**
 * Renders the agent's component in a Sandpack iframe. The code is
 * model-generated, so it runs sandboxed rather than in the extension's own page.
 */
export function HomepagePreview({ code }: { code: string }) {
  const files = {
    "/App.js": { code },
    "/index.js": { code: INDEX_JS },
    "/index.html": { code: INDEX_HTML },
  };

  return (
    <SandpackProvider files={files} template="react" options={{ autorun: true }}>
      <SandpackLayout style={{ height: "100vh", width: "100vw" }}>
        <SandpackPreview style={{ height: "100%" }} />
      </SandpackLayout>
    </SandpackProvider>
  );
}
