/// <reference path="../apps/extension/.wxt/types/imports.d.ts" />
import { afterEach, expect, test } from "bun:test";
import { DEFAULT_SYSTEM_PROMPT } from "../apps/extension/lib/default-prompt";
import { KEYS, loadSettings, saveSetting } from "../apps/extension/lib/storage";

const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser");

afterEach(() => {
  if (originalBrowser) Object.defineProperty(globalThis, "browser", originalBrowser);
  else Reflect.deleteProperty(globalThis, "browser");
});

function mockStorage(initial: Record<string, unknown>) {
  const values = { ...initial };
  const writes: Record<string, unknown>[] = [];
  Object.defineProperty(globalThis, "browser", {
    configurable: true,
    value: { storage: { local: {
      get: async () => ({ ...values }),
      set: async (update: Record<string, unknown>) => {
        writes.push(update);
        Object.assign(values, update);
      },
    } } },
  });
  return { values, writes };
}

test("fresh and legacy blank settings use the newspaper brief without writing storage", async () => {
  for (const stored of [undefined, "", " \n\t "]) {
    const storage = mockStorage(stored === undefined ? {} : { [KEYS.systemPrompt]: stored });
    const settings = await loadSettings();
    expect(settings.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(settings.socialPulse.enabled).toBe(false);
    expect(storage.writes).toEqual([]);
  }
});

test("custom instructions survive loading and editing verbatim", async () => {
  const original = "  Only show Laravel releases.\nKeep my exact wording.  ";
  mockStorage({ [KEYS.systemPrompt]: original });
  expect((await loadSettings()).systemPrompt).toBe(original);
  const edited = "My edited newspaper brief\nFocus on FastAPI.";
  await saveSetting("systemPrompt", edited);
  expect((await loadSettings()).systemPrompt).toBe(edited);
});

test("deliberately clearing instructions persists the empty value with its marker atomically", async () => {
  const storage = mockStorage({ [KEYS.systemPrompt]: "Custom brief" });
  for (const blank of ["", " \n\t "]) {
    await saveSetting("systemPrompt", blank);
    expect(storage.writes.at(-1)).toEqual({
      [KEYS.systemPrompt]: blank,
      [KEYS.systemPromptConfigured]: true,
    });
    expect((await loadSettings()).systemPrompt).toBe(blank);
  }
});

test("saving another setting does not mark a legacy blank prompt as configured", async () => {
  const storage = mockStorage({ [KEYS.systemPrompt]: "" });
  await saveSetting("autoRebuild", false);
  expect(storage.writes).toEqual([{ [KEYS.autoRebuild]: false }]);
  expect((await loadSettings()).systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT);
});
