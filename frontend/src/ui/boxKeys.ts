import { keyList, pressesKey, type Key } from "../ipc";

type BoxKey = "submit" | "cancel";

type BoxKeyPress = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing"
> &
  Pick<KeyboardEvent, "preventDefault" | "stopPropagation">;

const BOX_KEYS: Readonly<Record<BoxKey, readonly Key[]>> = {
  submit: keyList("Mod-Enter"),
  cancel: keyList("Escape"),
};

function boxKey(event: BoxKeyPress, platform: string): BoxKey | null {
  if (event.isComposing) {
    return null;
  }
  if (pressesKey(event, BOX_KEYS.submit, platform)) {
    return "submit";
  }
  return pressesKey(event, BOX_KEYS.cancel, platform) ? "cancel" : null;
}

export function boxKeydown(
  event: BoxKeyPress,
  platform: string,
  actions: Readonly<Record<BoxKey, () => void>>,
): void {
  const action = boxKey(event, platform);
  if (action === null) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  actions[action]();
}
