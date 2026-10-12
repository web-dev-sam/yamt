import { isModHeld } from "./modClick";

type HistoryKey = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "defaultPrevented" | "target"
>;

const TEXT_FIELDS: Readonly<Record<string, true>> = { INPUT: true, TEXTAREA: true };
const LATIN_LETTER = /^[a-z]$/i;
const ANY_LETTER = /^\p{L}$/u;
const LETTER_CODE = /^Key([A-Z])$/;

function inTextField(target: EventTarget | null): boolean {
  return (
    target !== null &&
    "tagName" in target &&
    typeof target.tagName === "string" &&
    Object.hasOwn(TEXT_FIELDS, target.tagName)
  );
}

// A non-Latin layout gives `key` 'я' for Ctrl+Z; like CodeMirror's runHandlers (keyCode fallback,
// @codemirror/view keymap.ts: keyCode follows a Latin layout, so Dvorak's ';' on KeyZ stays ';'),
// the physical key decides only then.
function letterOf({ key, code }: Pick<KeyboardEvent, "key" | "code">): string {
  if (LATIN_LETTER.test(key)) {
    return key.toLowerCase();
  }
  if (!ANY_LETTER.test(key)) {
    return "";
  }
  return LETTER_CODE.exec(code)?.[1]?.toLowerCase() ?? "";
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
  switch (letterOf(event)) {
    case "z":
      return event.shiftKey ? "redo" : "undo";
    case "y":
      return "redo";
    default:
      return null;
  }
}
