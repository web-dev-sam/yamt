import { expect, test } from "vitest";
import { nextTick, shallowRef } from "vue";

import { startSettings } from "./settings";
import {
  registerSettingsStore,
  useSettingsStore,
  useThemeAttribute,
  type SettingsStore,
} from "./settingsStore";

async function nothing(): Promise<void> {}

function nothingShown(): void {}

function settingsStore(settings = shallowRef(startSettings("dark"))): SettingsStore {
  return {
    settings,
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

test("the page's theme attribute and color-scheme follow the theme in use, a light editor theme light", async () => {
  const settings = shallowRef(startSettings("dark"));
  registerSettingsStore(settingsStore(settings));
  const root = { dataset: {}, style: { colorScheme: "" } };
  useThemeAttribute(root);

  expect(root).toEqual({ dataset: { theme: "dark" }, style: { colorScheme: "dark" } });

  settings.value = { ...settings.value, theme: "vscode-light" };
  await nextTick();
  expect(root).toEqual({ dataset: { theme: "vscode-light" }, style: { colorScheme: "light" } });

  settings.value = { ...settings.value, theme: "zed-dark" };
  await nextTick();
  expect(root).toEqual({ dataset: { theme: "zed-dark" }, style: { colorScheme: "dark" } });
});
