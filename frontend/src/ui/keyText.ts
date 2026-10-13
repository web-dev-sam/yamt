import type { KeyAction } from "../ipc";

export const ACTION_NAMES: Readonly<Record<KeyAction, string>> = {
  apply: "Apply",
  ignore: "Ignore",
  "next-change": "Next change",
  "previous-change": "Previous change",
  "left-side": "Left side",
  "right-side": "Right side",
  undo: "Undo",
  redo: "Redo",
  find: "Find",
  "find-next": "Find next",
  "find-previous": "Find previous",
  "close-find": "Close find",
  indent: "Indent",
  outdent: "Outdent",
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
  find: "in any pane",
  "find-next": "in a pane or its find box",
  "find-previous": "in a pane or its find box",
  "close-find": "in a pane or its find box",
  indent: "in the Result pane",
  outdent: "in the Result pane",
};

export const KEYMAP_GROUPS: readonly {
  readonly title: string;
  readonly actions: readonly KeyAction[];
}[] = [
  {
    title: "Side panes",
    actions: ["apply", "ignore", "next-change", "previous-change", "left-side", "right-side"],
  },
  { title: "Anywhere in the file", actions: ["undo", "redo"] },
  { title: "Find", actions: ["find", "find-next", "find-previous", "close-find"] },
  { title: "Result pane", actions: ["indent", "outdent"] },
];
