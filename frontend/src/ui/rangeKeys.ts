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

const TEXT_INPUT_TYPES: Readonly<Record<string, true>> = {
  email: true,
  number: true,
  password: true,
  search: true,
  tel: true,
  text: true,
  url: true,
};

export function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || !("tagName" in target)) {
    return false;
  }
  switch (target.tagName) {
    case "TEXTAREA":
      return true;
    case "INPUT":
      return (
        "type" in target &&
        typeof target.type === "string" &&
        Object.hasOwn(TEXT_INPUT_TYPES, target.type)
      );
    default:
      return false;
  }
}

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
