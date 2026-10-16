import type { ShallowRef } from "vue";

import { pressesKey } from "../ipc";
import type { Asking } from "./asking";
import type { SettingsInUse } from "./settings";

export type KeyPress = Parameters<typeof pressesKey>[0] &
  Pick<KeyboardEvent, "defaultPrevented" | "preventDefault">;

type FileListToggle = {
  readonly asking: Asking;
  readonly settings: Readonly<ShallowRef<SettingsInUse>>;
  readonly fileListShown: ShallowRef<boolean>;
};

export function fileListKey(target: FileListToggle, event: KeyPress, platform: string): void {
  if (
    event.defaultPrevented ||
    target.asking.question.value !== null ||
    !pressesKey(event, target.settings.value.keys.bindings["toggle-file-list"], platform)
  ) {
    return;
  }
  event.preventDefault();
  target.fileListShown.value = !target.fileListShown.value;
}
