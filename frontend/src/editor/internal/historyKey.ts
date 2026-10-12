import { isModHeld } from "./modClick";

type HistoryKey = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "defaultPrevented" | "target"
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

export function historyCommand(event: HistoryKey, platform: string): "undo" | "redo" | null {
  if (
    event.defaultPrevented ||
    event.altKey ||
    !isModHeld(event, platform) ||
    inTextField(event.target)
  ) {
    return null;
  }
  switch (event.key.toLowerCase()) {
    case "z":
      return event.shiftKey ? "redo" : "undo";
    case "y":
      return "redo";
    default:
      return null;
  }
}
