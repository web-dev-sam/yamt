import { isMac } from "../ipc";

type BoxKey = "submit" | "cancel";

type BoxKeyPress = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing"
> &
  Pick<KeyboardEvent, "preventDefault" | "stopPropagation">;

type WindowKeyPress = Pick<KeyboardEvent, "target" | "ctrlKey" | "metaKey">;

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

export function typesIntoField(event: WindowKeyPress): boolean {
  return isTypingTarget(event.target) && !event.ctrlKey && !event.metaKey;
}

function boxKey(event: BoxKeyPress, platform: string): BoxKey | null {
  const { key, ctrlKey, metaKey, altKey, shiftKey } = event;
  if (event.isComposing || altKey || shiftKey) {
    return null;
  }
  if (key === "Escape") {
    return ctrlKey || metaKey ? null : "cancel";
  }
  const command = isMac(platform) ? metaKey && !ctrlKey : ctrlKey && !metaKey;
  return key === "Enter" && command ? "submit" : null;
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
