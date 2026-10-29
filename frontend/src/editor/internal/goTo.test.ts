import { EditorState, type TransactionSpec } from "@codemirror/state";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, type FileMergeData } from "../../ipc";
import { chunkField } from "./chunkField";
import { toDocPos, type DocPos } from "./docPos";
import { foldRuns } from "./foldRuns";
import { foldFields, paneFolds, sideReveal, type FoldFields } from "./folds";
import { displayedIn } from "./foldSteps";
import { centerFolds, sideFolds } from "./foldView";
import type { Pane } from "./geometry";
import { changeLines, goTo, matchRange, resultLineUp, type PaneMatch } from "./goTo";
import { paneState, type PaneSettings } from "./pane";
import { lineSeparator, paneDocs } from "./paneDocs";

const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};

type FakeView = {
  state: EditorState;
  readonly calls: string[];
  readonly specs: TransactionSpec[];
  dispatch(spec: TransactionSpec): void;
  focus(): void;
};

type Opened = {
  readonly data: FileMergeData;
  readonly fields: FoldFields;
  readonly center: EditorState;
  readonly left: EditorState;
};

function fakeView(state: EditorState): FakeView {
  const view: FakeView = {
    state,
    calls: [],
    specs: [],
    dispatch(spec) {
      view.specs.push(spec);
      view.state = view.state.update(spec).state;
      view.calls.push("dispatch");
    },
    focus() {
      view.calls.push("focus");
    },
  };
  return view;
}

function docOf(text: string, crlf = false): EditorState {
  return EditorState.create({ doc: text, extensions: crlf ? lineSeparator("CrLf") : [] });
}

function selected(state: EditorState): string {
  const { from, to } = state.selection.main;
  return state.sliceDoc(from, to);
}

function numbered(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `line ${from + index}`);
}

function noViews(): never {
  throw new Error("a state test has no views");
}

async function oneLocalChange(): Promise<FileMergeData> {
  const middle = numbered(1, 60);
  const local = [...numbered(1, 10), "local a", "local b", ...numbered(12, 60)];
  const record = {
    path: "synthetic.ts",
    deleted: null,
    middle: { kind: "Stages", text: `${middle.join("\n")}\n` },
    local: `${local.join("\n")}\n`,
    remote: `${middle.join("\n")}\n`,
    eol: "Lf",
    disk_version: 0,
    chunks: [
      {
        chunk: {
          id: 0,
          kind: "LocalOnly",
          base: { start: 10, len: 1 },
          local: { start: 10, len: 2 },
          remote: { start: 10, len: 1 },
        },
        middle: { start: 10, len: 1 },
        words: {
          chunk: 0,
          local: { changed: [], removals: [] },
          remote: { changed: [], removals: [] },
        },
        waiting: { kind: "SideLines" },
      },
    ],
  };
  return loadFixture("synthetic.ts", { "synthetic.json": record });
}

async function opened(): Promise<Opened> {
  const data = await oneLocalChange();
  const docs = paneDocs(data);
  const fields = foldFields(foldRuns(data.chunks, docs), true);
  const wiring = { folds: fields, hovered: () => null, views: noViews };
  const common = { eol: data.eol, language: null, settings: SETTINGS };
  const center = paneState({
    ...common,
    kind: "center",
    doc: docs.center,
    extensions: [chunkField(data.chunks), centerFolds(wiring)],
  });
  const left = paneState({
    ...common,
    kind: "side",
    doc: docs.left,
    extensions: sideFolds(wiring, "left"),
  });
  return { data, fields, center, left };
}

function hides(fields: FoldFields, pane: Pane, state: EditorState, line: number): boolean {
  const pos = state.doc.line(line + 1).from;
  return displayedIn(paneFolds(fields, pane, state), pane).some(
    (hidden) => hidden.from <= pos && pos <= hidden.to,
  );
}

function span(from: number, to: number): { from: DocPos; to: DocPos } {
  return { from: toDocPos(from), to: toDocPos(to) };
}

test("matchRange keeps a match inside the document: a line past the end is the last line, columns past the line end are its end", () => {
  const doc = docOf("alpha\nbeta\ngamma").doc;

  expect(matchRange(doc, { line: 1, from: 1, to: 3 })).toEqual({ from: 7, to: 9 });
  expect(matchRange(doc, { line: 9, from: 1, to: 3 })).toEqual({ from: 12, to: 14 });
  expect(matchRange(doc, { line: 0, from: 3, to: 40 })).toEqual({ from: 3, to: 5 });
  expect(matchRange(doc, { line: 2, from: 30, to: 40 })).toEqual({ from: 16, to: 16 });
});

test("changeLines: a span of whole lines, an insertion point between lines and one after a last line without a break", () => {
  const doc = docOf("a\nb\nc").doc;

  expect(changeLines(doc, span(2, 4))).toEqual({ start: 1, len: 1 });
  expect(changeLines(doc, span(2, 2))).toEqual({ start: 1, len: 0 });
  expect(changeLines(doc, span(5, 5))).toEqual({ start: 3, len: 0 });
  expect(changeLines(doc, span(0, 0))).toEqual({ start: 0, len: 0 });
});

test("changeLines: a span ending mid-line at the document's end holds that last line", () => {
  const doc = docOf("a\nb\nc").doc;

  expect(changeLines(doc, span(2, 5))).toEqual({ start: 1, len: 2 });
  expect(changeLines(doc, span(4, 5))).toEqual({ start: 2, len: 1 });
});

test("changeLines on a CRLF document counts each \\r\\n as one line break", () => {
  const state = docOf("a\r\nb\r\nc\r\n", true);
  const { doc } = state;
  const second = doc.line(2);
  const end = doc.line(4).from;

  expect(doc.lines).toBe(4);
  expect(changeLines(doc, span(second.from, end))).toEqual({ start: 1, len: 2 });
  expect(changeLines(doc, span(end, end))).toEqual({ start: 3, len: 0 });
});

test("goTo selects the match as find does, then gives the pane the keyboard", () => {
  const view = fakeView(docOf("one\ntwo words\nthree"));

  goTo(view, { line: 1, from: 4, to: 9 });

  expect(selected(view.state)).toBe("words");
  expect(view.specs.map((spec) => spec.userEvent)).toEqual(["select.search"]);
  expect(view.calls).toEqual(["dispatch", "focus"]);
});

test("goTo without a match only gives the pane the keyboard", () => {
  const view = fakeView(docOf("one\ntwo"));

  goTo(view, null);

  expect(view.state.selection.main.head).toBe(0);
  expect(view.calls).toEqual(["focus"]);
});

test("a stale match past the document's end selects at its last line and throws nothing", () => {
  const view = fakeView(docOf("one\ntwo"));

  goTo(view, { line: 7, from: 1, to: 9 });

  expect(selected(view.state)).toBe("wo");
});

test("a go-to on a collapsed Result shows the run around the match", async () => {
  const { fields, center } = await opened();
  const match: PaneMatch = { line: 40, from: 5, to: 7 };
  expect(hides(fields, "center", center, match.line)).toBe(true);
  const view = fakeView(center);

  goTo(view, match);

  expect(selected(view.state)).toBe("41");
  expect(hides(fields, "center", view.state, match.line)).toBe(false);
});

test("a go-to in a collapsed side pane asks the Result to show the same run", async () => {
  const { fields, center, left } = await opened();
  const match: PaneMatch = { line: 41, from: 5, to: 7 };
  expect(hides(fields, "left", left, match.line)).toBe(true);
  const view = fakeView(left);

  goTo(view, match);
  const reveal = sideReveal(fields, "left", view.state);
  const shown = reveal === null ? center : center.update(reveal).state;

  expect(selected(view.state)).toBe("41");
  expect(reveal).not.toBeNull();
  expect(hides(fields, "center", shown, 40)).toBe(false);
});

test("resultLineUp: the Result's text, each change's live lines in the Result and its fixed side lines", async () => {
  const { data, center } = await opened();
  const field = chunkField(data.chunks);
  const state = EditorState.create({ doc: center.doc, extensions: field });
  const typed = state.update({ changes: { from: state.doc.line(11).to, insert: "\nmore" } }).state;

  expect(resultLineUp(state, field, "shown")).toEqual({
    result: "shown",
    changes: [
      {
        left: { start: 10, len: 2 },
        center: { start: 10, len: 1 },
        right: { start: 10, len: 1 },
      },
    ],
  });
  expect(resultLineUp(typed, field, "typed").changes).toEqual([
    {
      left: { start: 10, len: 2 },
      center: { start: 10, len: 2 },
      right: { start: 10, len: 1 },
    },
  ]);
});
