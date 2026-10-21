import type { ShallowRef } from "vue";

import type { SettingsActions, SettingsInUse } from "./settings";

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
