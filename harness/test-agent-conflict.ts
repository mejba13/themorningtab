import Anthropic from "@anthropic-ai/sdk";
import { strict as assert } from "node:assert";
import { ensureAgent } from "../packages/agent-core/setup";
import type { KVStore } from "../packages/agent-core/types";

// Start: postman mock run postman/mocks/agent-conflict/default.js --port 4900 --no-history
const baseURL = "http://127.0.0.1:4900";
for (const mode of ["retry", "adopt", "exhaust", "reject"]) {
  const run = crypto.randomUUID();
  const client = new Anthropic({
    apiKey: "fixture-not-real", baseURL,
    defaultHeaders: { "x-test-run": run },
  });
  const store: KVStore = {
    get: async <T>() => mode as T,
    set: async () => { throw new Error("Must reuse existing agent"); },
    remove: async () => { throw new Error("Must not discard existing agent"); },
  };
  if (mode === "exhaust" || mode === "reject") {
    await assert.rejects(ensureAgent(client, store), (error: unknown) =>
      error instanceof Anthropic.APIError && error.status === (mode === "exhaust" ? 409 : 400));
  } else {
    assert.equal(await ensureAgent(client, store), mode);
  }
  const state = await fetch(baseURL + "/v1/agents/" + mode + "?beta=true", {
    headers: { "x-test-run": run },
  }).then(r => r.json()) as { updates: number[] };
  assert.deepEqual(state.updates, mode === "retry" ? [1, 2] : mode === "exhaust" ? [1, 2, 3] : [1]);
  console.log("PASS", mode, state.updates);
}
