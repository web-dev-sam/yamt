import type { ShallowRef } from "vue";

import { pressesKey } from "../ipc";
import type { Asking } from "./asking";
import type { SettingsInUse } from "./settings";

export type KeyPress = Parameters<typeof pressesKey>[0] &
  Pick<KeyboardEvent, "defaultPrevented" | "preventDefault">;

export type WindowKeyTarget = {
  readonly asking: Asking;
  readonly settings: Readonly<ShallowRef<SettingsInUse>>;
};

type FileListToggle = WindowKeyTarget & { readonly fileListShown: ShallowRef<boolean> };

export function windowKey(
  target: WindowKeyTarget,
  action: "toggle-file-list" | "toggle-search",
  event: KeyPress,
  platform: string,
): boolean {
  if (
    event.defaultPrevented ||
    target.asking.question.value !== null ||
    !pressesKey(event, target.settings.value.keys.bindings[action], platform)
  ) {
    return false;
  }
  event.preventDefault();
  return true;
}

export function fileListKey(target: FileListToggle, event: KeyPress, platform: string): void {
  if (windowKey(target, "toggle-file-list", event, platform)) {
    target.fileListShown.value = !target.fileListShown.value;
  }
}
