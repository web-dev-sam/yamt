import { expect, test } from "vitest";

import { KEY_ACTIONS } from "../ipc";
import { ACTION_PLACES, KEYMAP_GROUPS } from "./keyText";

test("the keymap groups list every action once, in the settings order", () => {
  expect(KEYMAP_GROUPS.flatMap(({ actions }) => actions)).toEqual(KEY_ACTIONS);
  expect(KEYMAP_GROUPS.map(({ title }) => title)).toEqual([
    "Side panes",
    "Anywhere in the file",
    "Find",
    "Result pane",
  ]);
});

test("each action says where it acts, matching its group", () => {
  expect(ACTION_PLACES.apply).toContain("side pane");
  expect(ACTION_PLACES.undo).toBe("anywhere in the shown file");
  expect(ACTION_PLACES["close-find"]).toContain("find box");
  expect(ACTION_PLACES.indent).toBe("in the Result pane");
});
