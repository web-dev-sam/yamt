import { expect, test } from "vitest";

import { serverKey, type ServerState, type ServerView } from "../lsp";
import { DOT_CLASSES, serverButtons } from "./serverButtons";
import { stateLine } from "./serverText";

function view(name: string, key: string, state: ServerState): ServerView {
  return {
    key: serverKey(key),
    name,
    project: "",
    state,
    help: null,
    notes: [],
  };
}

const VIEWS = [
  view("oxlint", "oxlint (repository root)", { kind: "running" }),
  view("TypeScript", "TypeScript (repository root)", { kind: "stopped" }),
  view("eslint", "eslint (repository root)", { kind: "crashed", code: 3 }),
];

test("one button per view, in view order, named by the shown name and keyed by the key", () => {
  const buttons = serverButtons(VIEWS, new Set());
  expect(buttons.map(({ name, key }) => [name, key])).toEqual([
    ["oxlint", "oxlint (repository root)"],
    ["TypeScript", "TypeScript (repository root)"],
    ["eslint", "eslint (repository root)"],
  ]);
});

test("a button is pinned when its key is pinned, never by its shown name", () => {
  const buttons = serverButtons(VIEWS, new Set(["eslint (repository root)", "TypeScript"]));
  expect(buttons.map(({ pinned }) => pinned)).toEqual([false, false, true]);
});

test("a button's title is its state line and its dot the state's dot class", () => {
  const buttons = serverButtons(VIEWS, new Set());
  expect(buttons.map(({ title }) => title)).toEqual(VIEWS.map((each) => stateLine(each.state)));
  expect(buttons.map(({ dot }) => dot)).toEqual([
    DOT_CLASSES.running,
    DOT_CLASSES.stopped,
    DOT_CLASSES.problem,
  ]);
});
