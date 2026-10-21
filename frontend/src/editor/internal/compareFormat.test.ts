import { history, undo, undoDepth } from "@codemirror/commands";
import { EditorState, type TransactionSpec } from "@codemirror/state";
import { expect, test } from "vitest";

import { formatColumns, type FormatTarget } from "./compareFormat";

type Held = FormatTarget & { state: EditorState };

function column(text: string): Held {
  const held: Held = {
    state: EditorState.create({ doc: text, extensions: history() }),
    dispatch(spec: TransactionSpec) {
      held.state = held.state.update(spec).state;
    },
  };
  return held;
}

function undone(held: Held): void {
  undo({
    state: held.state,
    dispatch: (tr) => {
      held.state = tr.state;
    },
  });
}

const MINIFIED = '{"b":1,"a":[1,2],"c":{"d":null}}\n';
const PRETTY = '{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ],\n  "c": {\n    "d": null\n  }\n}\n';

test("one undo restores a formatted column, cursor at the start", () => {
  const left = column(MINIFIED);
  const right = column(MINIFIED);

  const report = formatColumns({ left, right }, "JSON");

  expect(report).toEqual({ left: { kind: "formatted" }, right: { kind: "formatted" } });
  expect(left.state.sliceDoc()).toBe(PRETTY);
  expect(left.state.selection.main.head).toBe(0);
  expect(undoDepth(left.state)).toBe(1);
  undone(left);
  expect(left.state.sliceDoc()).toBe(MINIFIED);
});

test("a failing column is left alone and named with its line while the other is formatted", () => {
  const broken = '{\n  "a": 1\n  "b": 2\n}\n';
  const left = column(broken);
  const right = column(MINIFIED);

  const report = formatColumns({ left, right }, "JSON");

  expect(report.left).toMatchObject({ kind: "failed", line: 3 });
  expect(report.right).toEqual({ kind: "formatted" });
  expect(left.state.sliceDoc()).toBe(broken);
  expect(undoDepth(left.state)).toBe(0);
  expect(right.state.sliceDoc()).toBe(PRETTY);
});

test("an already formatted column reports unchanged and adds no undo step", () => {
  const left = column(PRETTY);
  const right = column("<a><b>x</b></a>\n");

  const json = formatColumns({ left, right: column(PRETTY) }, "JSON");
  const xml = formatColumns({ left: column("<a>\n  <b>x</b>\n</a>\n"), right }, "XML");

  expect(json.left).toEqual({ kind: "unchanged" });
  expect(undoDepth(left.state)).toBe(0);
  expect(xml.right).toEqual({ kind: "formatted" });
  expect(right.state.sliceDoc()).toBe("<a>\n  <b>x</b>\n</a>\n");
  expect(xml.left).toEqual({ kind: "unchanged" });
});
