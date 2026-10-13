import { keyOfEvent, type Key } from "../ipc";

type FieldKey =
  | { readonly kind: "leave" }
  | { readonly kind: "cancel" }
  | { readonly kind: "confirm"; readonly key: Key }
  | { readonly kind: "record"; readonly key: Key }
  | { readonly kind: "ignore" };

// ShortcutTextField.processKeyEvent: plain Escape and (with a key shown) plain Enter go to the
// dialog, a modifier alone changes nothing, every other key with its modifiers replaces the shown one.
export function fieldKey(
  event: Parameters<typeof keyOfEvent>[0],
  shown: Key | null,
  platform: string,
): FieldKey {
  const modified = event.ctrlKey || event.metaKey || event.altKey;
  if (event.key === "Tab" && !modified) {
    return { kind: "leave" };
  }
  const plain = !modified && !event.shiftKey;
  if (plain && event.key === "Escape") {
    return { kind: "cancel" };
  }
  if (plain && event.key === "Enter" && shown !== null) {
    return { kind: "confirm", key: shown };
  }
  const key = keyOfEvent(event, platform);
  return key === null ? { kind: "ignore" } : { kind: "record", key };
}
