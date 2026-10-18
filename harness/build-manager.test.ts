/// <reference path="../apps/extension/.wxt/types/paths.d.ts" />
/// <reference path="../apps/extension/.wxt/types/imports.d.ts" />
import { afterEach, expect, test } from "bun:test";
import { BuildManager } from "../apps/extension/lib/build-manager";
import type { runHomepageBuild } from "../packages/agent-core";
import type { BuildMsg } from "../apps/extension/lib/protocol";

const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser");
afterEach(() => {
  if (originalBrowser) Object.defineProperty(globalThis, "browser", originalBrowser);
  else Reflect.deleteProperty(globalThis, "browser");
});
function fixture(run: typeof runHomepageBuild, read: () => Promise<Record<string, unknown>>) {
  const messages: BuildMsg[] = [];
  Object.defineProperty(globalThis, "browser", { configurable: true, value: {
    storage: { local: { get: read, set: async () => {} } },
  } });
  const manager = new BuildManager(run);
  manager.attach({
    postMessage: (msg: BuildMsg) => messages.push(msg),
    onMessage: { addListener() {} }, onDisconnect: { addListener() {} },
  } as unknown as Parameters<BuildManager["attach"]>[0]);
  return { manager, messages };
}
test("simultaneous starts run once and duplicate requests receive current state", async () => {
  let release!: (value: Record<string, unknown>) => void;
  const settings = new Promise<Record<string, unknown>>(resolve => { release = resolve; });
  let calls = 0;
  const { manager, messages } = fixture(async () => {
    calls++;
    throw new Error("Fixture complete");
  }, () => settings);
  const first = manager.startBuild();
  await manager.startBuild();
  expect(messages.filter(m => m.kind === "snapshot")).toHaveLength(2);
  release({ apiKey: "fixture-not-real" });
  await first;
  expect(calls).toBe(1);
  expect(messages.at(-1)?.kind).toBe("error");
});
test("cancel during settings loading prevents the runner starting", async () => {
  let release!: (value: Record<string, unknown>) => void;
  const settings = new Promise<Record<string, unknown>>(resolve => { release = resolve; });
  let calls = 0;
  const { manager } = fixture(async () => { calls++; throw new Error("Unexpected"); }, () => settings);
  const first = manager.startBuild();
  manager.cancel();
  release({ apiKey: "fixture-not-real" });
  await first;
  expect(calls).toBe(0);
});
test("missing key and failed settings reads release the startup lock", async () => {
  let reads = 0;
  let calls = 0;
  const { manager } = fixture(async () => { calls++; throw new Error("Fixture complete"); }, async () => {
    reads++;
    if (reads === 1) throw new Error("Storage unavailable");
    return reads === 2 ? {} : { apiKey: "fixture-not-real" };
  });
  await manager.startBuild();
  await manager.startBuild();
  await manager.startBuild();
  expect(calls).toBe(1);
});
