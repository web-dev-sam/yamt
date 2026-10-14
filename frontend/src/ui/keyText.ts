import { keyLabel, parseKey, type Key, type KeyAction } from "../ipc";
import { isDefault } from "./keymapEdit";

export type KeymapCommand =
  | { readonly kind: "add" }
  | { readonly kind: "change"; readonly key: Key }
  | { readonly kind: "remove"; readonly key: Key }
  | { readonly kind: "removeAll" }
  | { readonly kind: "reset" };

export type KeymapMenuEntry =
  | { readonly kind: "separator" }
  | { readonly kind: "command"; readonly label: string; readonly command: KeymapCommand };

type SetKeyEntry = { readonly label: string; readonly key: Key };

export const ACTION_NAMES: Readonly<Record<KeyAction, string>> = {
  apply: "Apply",
  ignore: "Ignore",
  "next-change": "Next change",
  "previous-change": "Previous change",
  "left-side": "Left side",
  "right-side": "Right side",
  undo: "Undo",
  redo: "Redo",
  save: "Save",
  find: "Find",
  "find-next": "Find next",
  "find-previous": "Find previous",
  "close-find": "Close find",
  indent: "Indent",
  outdent: "Outdent",
  "toggle-file-list": "Toggle file list",
};

export const ACTION_PLACES: Readonly<Record<KeyAction, string>> = {
  apply: "on the focused change of a side pane",
  ignore: "on the focused change of a side pane",
  "next-change": "in a side pane",
  "previous-change": "in a side pane",
  "left-side": "in a side pane",
  "right-side": "in a side pane",
  undo: "anywhere in the shown file",
  redo: "anywhere in the shown file",
  save: "anywhere in the shown file",
  find: "in any pane",
  "find-next": "in a pane or its find box",
  "find-previous": "in a pane or its find box",
  "close-find": "in a pane or its find box",
  indent: "in the Result pane",
  outdent: "in the Result pane",
  "toggle-file-list": "anywhere in the window",
};

export const KEYMAP_GROUPS: readonly {
  readonly title: string;
  readonly actions: readonly KeyAction[];
}[] = [
  {
    title: "Side panes",
    actions: ["apply", "ignore", "next-change", "previous-change", "left-side", "right-side"],
  },
  { title: "Anywhere in the file", actions: ["undo", "redo", "save"] },
  { title: "Find", actions: ["find", "find-next", "find-previous", "close-find"] },
  { title: "Result pane", actions: ["indent", "outdent"] },
  { title: "Window", actions: ["toggle-file-list"] },
];

const SEPARATOR: KeymapMenuEntry = { kind: "separator" };

const KEYS_WITHOUT_REMOVE_ALL = 2;

// WebStorm's Keymap edit menu (KeymapPanel.createEditActionGroup): Remove All only past two keys,
// Reset Shortcuts right after it without a separator.
export function keymapMenu(
  action: KeyAction,
  keys: readonly Key[],
  platform: string,
): KeymapMenuEntry[] {
  const entries: KeymapMenuEntry[] = [
    { kind: "command", label: "Add Keyboard Shortcut", command: { kind: "add" } },
    SEPARATOR,
  ];
  for (const key of keys) {
    const label = keyLabel(key, platform);
    entries.push(
      { kind: "command", label: `Change ${label}…`, command: { kind: "change", key } },
      { kind: "command", label: `Remove ${label}`, command: { kind: "remove", key } },
    );
  }
  const removeAll = keys.length > KEYS_WITHOUT_REMOVE_ALL;
  if (removeAll) {
    entries.push(SEPARATOR, {
      kind: "command",
      label: "Remove All",
      command: { kind: "removeAll" },
    });
  }
  if (!isDefault(action, keys)) {
    entries.push(...(removeAll ? [] : [SEPARATOR]), {
      kind: "command",
      label: "Reset Shortcuts",
      command: { kind: "reset" },
    });
  }
  return entries.filter(
    (entry, index) => entry.kind !== "separator" || entries[index - 1]?.kind !== "separator",
  );
}

// The keys a focus traversal or the dialog itself would take (ShortcutTextField.getKeyStrokes).
const SET_KEYS: readonly Key[] = ["Enter", "Escape", "Tab", "Shift-Tab"].map((text) => {
  const key = parseKey(text);
  if (key === null) {
    throw new Error(`set key ${text} does not parse`);
  }
  return key;
});

export function setKeyMenu(platform: string): SetKeyEntry[] {
  return SET_KEYS.map((key) => ({ label: `Set ${keyLabel(key, platform)}`, key }));
}

export function usedByText(owners: readonly KeyAction[]): string {
  return `Already used by: ${owners.map((owner) => ACTION_NAMES[owner]).join(", ")}`;
}
