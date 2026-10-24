import { watch, type ShallowRef } from "vue";

import { themeKind } from "../ipc";
import type { SettingsActions, SettingsInUse } from "./settings";

type ThemedRoot = {
  readonly dataset: DOMStringMap;
  readonly style: Pick<CSSStyleDeclaration, "colorScheme">;
};

export type SettingsStore = Pick<
  SettingsActions,
  | "setTheme"
  | "setAntialiasing"
  | "moveSettings"
  | "addKey"
  | "changeKey"
  | "removeKey"
  | "removeAllKeys"
  | "resetKeys"
> & {
  readonly settings: Readonly<ShallowRef<SettingsInUse>>;
  openSettings(): void;
  closeSettings(): void;
};

let registered: SettingsStore | null = null;

export function registerSettingsStore(store: SettingsStore): void {
  registered = store;
}

export function useSettingsStore(): SettingsStore {
  if (registered === null) {
    throw new Error("useSettingsStore() called before registerSettingsStore()");
  }
  return registered;
}

export function useThemeAttribute(root: ThemedRoot = document.documentElement): void {
  const { settings } = useSettingsStore();
  watch(
    () => settings.value.theme,
    (theme) => {
      root.dataset["theme"] = theme;
      root.style.colorScheme = themeKind(theme);
    },
    { immediate: true },
  );
}
