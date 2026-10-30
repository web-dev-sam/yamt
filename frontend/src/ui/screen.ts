import type { ShallowRef } from "vue";

export type Screen =
  | { readonly kind: "files" }
  | { readonly kind: "settings" }
  | { readonly kind: "serverLog"; readonly name: string }
  | { readonly kind: "mergeRequests" };

export type SettingsScreen = {
  openSettings(): void;
  closeSettings(): void;
};

export function settingsScreen(screen: ShallowRef<Screen>): SettingsScreen {
  return {
    openSettings: () => {
      screen.value = { kind: "settings" };
    },
    closeSettings: () => {
      screen.value = { kind: "files" };
    },
  };
}
