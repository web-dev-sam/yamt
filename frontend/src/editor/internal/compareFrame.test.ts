import { EditorState, type TransactionSpec } from "@codemirror/state";
import { BlockType, Decoration } from "@codemirror/view";
import { afterEach, expect, test, vi } from "vitest";

import type { Column } from "../../ipc";
import { differenceField, showDifferences } from "./compareFields";
import { CompareFrame, type LineBlock } from "./compareFrame";
import type { DiffSpan } from "./compareMarks";
import type { CompareRow } from "./compareStrip";
import { toDocPos } from "./docPos";
import { find } from "./find";
import { showThreadRows, threadAnchors, threadField } from "./threadField";
import type { ThreadRow } from "./threadRows";

const LINE_PX = 20;
const ROW_PX = 100;
const TEXT = Array.from({ length: 40 }, (_, index) => `line ${index}`).join("\n");
const NO_MARKS = { bands: Decoration.none, words: Decoration.none };
const CELLS = {
  height: () => ROW_PX,
  host: () => undefined,
  addCell: () => {},
  dropCell: () => {},
};

type FakeColumn = {
  state: EditorState;
  dispatch(spec: TransactionSpec): void;
  readonly scrollDOM: EventTarget & { scrollTop: number; readonly clientHeight: number };
  readonly documentPadding: { readonly top: number };
  readonly documentTop: number;
  lineBlockAt(pos: number): LineBlock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFrames(): () => void {
  const frames: (() => void)[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return () => {
    for (const frame of frames.splice(0)) {
      frame();
    }
  };
}

function fakeColumn(
  state: EditorState,
  blockAt: (column: FakeColumn, pos: number) => LineBlock,
  changed: (startState: EditorState, state: EditorState) => void = () => {},
): FakeColumn {
  const column: FakeColumn = {
    state,
    dispatch(spec) {
      const startState = column.state;
      column.state = startState.update(spec).state;
      changed(startState, column.state);
    },
    scrollDOM: Object.assign(new EventTarget(), { scrollTop: 0, clientHeight: 10 * LINE_PX }),
    documentPadding: { top: 0 },
    documentTop: 0,
    lineBlockAt: (pos) => blockAt(column, pos),
  };
  return column;
}

function plainColumn(
  measured: { count: number },
  changed: (startState: EditorState, state: EditorState) => void,
): FakeColumn {
  const state = EditorState.create({ doc: TEXT, extensions: [differenceField, find] });
  const line = state.doc.line(5);
  const spans: readonly DiffSpan[] = [
    { from: toDocPos(line.from), to: toDocPos(line.to + 1), tone: "modified" },
  ];
  const marked = state.update({ effects: showDifferences.of({ ...NO_MARKS, spans }) }).state;
  return fakeColumn(
    marked,
    (column, pos) => {
      measured.count += 1;
      const number = column.state.doc.lineAt(pos).number;
      return { top: (number - 1) * LINE_PX, bottom: number * LINE_PX, type: BlockType.Text };
    },
    changed,
  );
}

test("a scroll paints the strip from the cached rows; an edit measures them again", () => {
  const runFrames = stubFrames();
  const measured = { count: 0 };
  const painted: (readonly CompareRow[])[] = [];
  const holder: { frame: CompareFrame | null } = { frame: null };
  function changed(startState: EditorState, state: EditorState): void {
    holder.frame?.changed({ startState, state, geometryChanged: false });
  }
  const views = { left: plainColumn(measured, changed), right: plainColumn(measured, changed) };
  const frame = new CompareFrame({
    views,
    strip: {
      paint: (_panes, rows) => {
        painted.push(rows);
      },
    },
    fields: [differenceField],
    anchors: () => [],
  });
  holder.frame = frame;

  frame.request();
  runFrames();
  const atStart = measured.count;
  views.left.scrollDOM.scrollTop = 300;
  views.left.scrollDOM.dispatchEvent(new Event("scroll"));
  runFrames();
  views.left.dispatch({ selection: { anchor: 3 } });
  runFrames();
  const afterScroll = measured.count;
  views.left.dispatch({ changes: { from: 0, insert: "new\n" } });
  runFrames();

  expect(atStart).toBeGreaterThan(0);
  expect(afterScroll).toBe(atStart);
  expect(views.right.scrollDOM.scrollTop).toBe(300);
  expect(painted).toHaveLength(3);
  expect(painted[1]).toBe(painted[0]);
  expect(measured.count).toBeGreaterThan(afterScroll);
  expect(painted[2]?.[0]).toEqual({
    left: { top: 5 * LINE_PX, bottom: 6 * LINE_PX },
    right: { top: 4 * LINE_PX, bottom: 5 * LINE_PX },
    tone: "modified",
  });
});

const ROW: ThreadRow = {
  key: "10:13",
  place: { left: 10, right: 13 },
  keys: { left: ["thread-1"], right: [] },
  kind: "unchanged",
};

function rowBlock(column: FakeColumn, pos: number, above: number): LineBlock {
  const number = column.state.doc.lineAt(pos).number;
  const top = (number - 1) * LINE_PX + (number > above ? ROW_PX : 0);
  const text = { top, bottom: top + LINE_PX, type: BlockType.Text };
  if (number !== above) {
    return text;
  }
  const row = { top: text.bottom, bottom: text.bottom + ROW_PX, type: BlockType.WidgetAfter };
  return { top, bottom: row.bottom, type: [text, row] };
}

function rowColumn(column: Column, lines: number, spanLine: number | null): FakeColumn {
  const text = Array.from({ length: lines }, (_, index) => `line ${index}`).join("\n");
  const state = EditorState.create({ doc: text, extensions: [differenceField, threadField, find] });
  const spans: DiffSpan[] = [];
  if (spanLine !== null) {
    const { from, to } = state.doc.line(spanLine);
    spans.push({ from: toDocPos(from), to: toDocPos(to + 1), tone: "modified" });
  }
  const shown = { column, rows: [ROW], counts: [], cells: CELLS };
  const effects = [showDifferences.of({ ...NO_MARKS, spans }), showThreadRows.of(shown)];
  return fakeColumn(state.update({ effects }).state, (fake, pos) =>
    rowBlock(fake, pos, ROW.place[column]),
  );
}

function rightTopAfterScrollingLeft(views: Readonly<Record<Column, FakeColumn>>): number {
  const runFrames = stubFrames();
  const frame = new CompareFrame({
    views,
    strip: { paint: () => {} },
    fields: [differenceField, threadField],
    anchors: threadAnchors,
  });
  views.left.scrollDOM.scrollTop = 150;
  views.left.scrollDOM.dispatchEvent(new Event("scroll"));
  runFrames();
  frame.destroy();
  return views.right.scrollDOM.scrollTop;
}

test("an unchanged-line row adds the lines around it as anchors in both columns", () => {
  const views = { left: rowColumn("left", 40, null), right: rowColumn("right", 43, null) };

  expect(threadAnchors(views)).toEqual([
    { left: 10 * LINE_PX, right: 13 * LINE_PX },
    { left: 10 * LINE_PX + ROW_PX, right: 13 * LINE_PX + ROW_PX },
  ]);
  expect(rightTopAfterScrollingLeft(views)).toBe(210);
});

test("merged anchors stay sorted in both columns", () => {
  const views = { left: rowColumn("left", 40, 31), right: rowColumn("right", 43, 34) };

  expect(rightTopAfterScrollingLeft(views)).toBe(210);
});

const DELETION_ROW: ThreadRow = {
  key: "22:20",
  place: { left: 22, right: 20 },
  keys: { left: ["removed"], right: [] },
  kind: "rightEmpty",
};

function rowBeforeBlock(column: FakeColumn, pos: number, below: number): LineBlock {
  const number = column.state.doc.lineAt(pos).number;
  const top = (number - 1) * LINE_PX + (number > below ? ROW_PX : 0);
  if (number !== below) {
    return { top, bottom: top + LINE_PX, type: BlockType.Text };
  }
  const row = { top, bottom: top + ROW_PX, type: BlockType.WidgetBefore };
  const text = { top: row.bottom, bottom: row.bottom + LINE_PX, type: BlockType.Text };
  return { top, bottom: text.bottom, type: [row, text] };
}

function deletionColumn(
  column: Column,
  lines: number,
  span: { readonly from: number; readonly to: number },
): FakeColumn {
  const text = Array.from({ length: lines }, (_, index) => `line ${index}`).join("\n");
  const state = EditorState.create({ doc: text, extensions: [differenceField, threadField, find] });
  const { doc } = state;
  const from = toDocPos(doc.line(span.from).from);
  const spans: DiffSpan[] = [{ from, to: toDocPos(doc.line(span.to).from), tone: "deleted" }];
  const shown = { column, rows: [DELETION_ROW], counts: [], cells: CELLS };
  const effects = [showDifferences.of({ ...NO_MARKS, spans }), showThreadRows.of(shown)];
  return fakeColumn(state.update({ effects }).state, (fake, pos) =>
    column === "left"
      ? rowBlock(fake, pos, DELETION_ROW.place.left)
      : rowBeforeBlock(fake, pos, DELETION_ROW.place.right + 1),
  );
}

test("a removed line's row in a pure deletion grows both band edges by the row", () => {
  const runFrames = stubFrames();
  const painted: (readonly CompareRow[])[] = [];
  const views = {
    left: deletionColumn("left", 40, { from: 21, to: 23 }),
    right: deletionColumn("right", 38, { from: 21, to: 21 }),
  };
  const frame = new CompareFrame({
    views,
    strip: {
      paint: (_panes, rows) => {
        painted.push(rows);
      },
    },
    fields: [differenceField, threadField],
    anchors: threadAnchors,
  });
  views.left.scrollDOM.scrollTop = 150;
  views.left.scrollDOM.dispatchEvent(new Event("scroll"));
  runFrames();
  frame.destroy();

  expect(painted.at(-1)).toEqual([
    {
      left: { top: 20 * LINE_PX, bottom: 22 * LINE_PX + ROW_PX },
      right: { top: 20 * LINE_PX, bottom: 20 * LINE_PX + ROW_PX },
      tone: "deleted",
    },
  ]);
  expect(views.right.scrollDOM.scrollTop).toBe(150);
});
