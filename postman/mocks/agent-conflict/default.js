// Local fixture based on SDK 0.110's agent retrieve/update contract.
// Only these routes are simulated; no real Anthropic calls are made.
const http = require("http");
const records = new Map();
http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/v1\/agents\/(retry|adopt|exhaust|reject)$/);
  if (!match || url.searchParams.get("beta") !== "true") return send(404, {});
  const mode = match[1];
  const key = req.headers["x-test-run"] + mode;
  const state = records.get(key) || { id: mode, version: 1, metadata: {}, updates: [] };
  records.set(key, state);
  if (req.method === "GET") return send(200, state);
  if (req.method !== "POST") return send(405, {});
  let body = "";
  for await (const chunk of req) body += chunk;
  const params = JSON.parse(body);
  if (!params.metadata?.config || !params.system || !params.tools || params.version !== state.version) {
    return send(400, { type: "error", error: { type: "invalid_request_error", message: "Invalid update contract" } });
  }
  state.updates.push(params.version);
  if (mode === "reject") return send(400, { type: "error", error: { type: "invalid_request_error", message: "Rejected" } });
  if (state.updates.length === 1 || mode === "exhaust") {
    state.version++;
    if (mode === "adopt") state.metadata = params.metadata;
    return send(409, { type: "error", error: { type: "invalid_request_error", message: "Concurrent modification detected. Please fetch the latest version and retry." } });
  }
  state.version++;
  state.metadata = params.metadata;
  return send(200, state);
}).listen(process.env.PORT);
