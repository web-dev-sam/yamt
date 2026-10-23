import { expect, test } from "vitest";
import { shallowRef } from "vue";

import { startSettings } from "./settings";
import { registerSettingsStore, useSettingsStore, type SettingsStore } from "./settingsStore";

async function nothing(): Promise<void> {}

function nothingShown(): void {}

function settingsStore(): SettingsStore {
  return {
    settings: shallowRef(startSettings("dark")),
    openSettings: nothingShown,
    closeSettings: nothingShown,
    setTheme: nothing,
    setAntialiasing: nothing,
    moveSettings: nothing,
    addKey: nothing,
    changeKey: nothing,
    removeKey: nothing,
    removeAllKeys: nothing,
    resetKeys: nothing,
  };
}

test("the settings view gets the store its window root registered, and nothing before that", () => {
  expect(() => useSettingsStore()).toThrow(
    "useSettingsStore() called before registerSettingsStore()",
  );

  const store = settingsStore();
  registerSettingsStore(store);
  expect(useSettingsStore()).toBe(store);
});
