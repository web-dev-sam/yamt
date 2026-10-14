import { pressesKey, type KeyBindings } from "../../ipc";

type HistoryKey = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "defaultPrevented" | "target"
>;

const TEXT_FIELDS: Readonly<Record<string, true>> = { INPUT: true, TEXTAREA: true };

function inTextField(target: EventTarget | null): boolean {
  return (
    target !== null &&
    "tagName" in target &&
    typeof target.tagName === "string" &&
    Object.hasOwn(TEXT_FIELDS, target.tagName)
  );
}

export function historyCommand(
  event: HistoryKey,
  platform: string,
  keys: KeyBindings,
): "undo" | "redo" | null {
  if (event.defaultPrevented || inTextField(event.target)) {
    return null;
  }
  if (pressesKey(event, keys.undo, platform)) {
    return "undo";
  }
  return pressesKey(event, keys.redo, platform) ? "redo" : null;
}
