import { EditorState, type TransactionSpec } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { afterEach, expect, test, vi } from "vitest";

import type { Span } from "../../connectors";
import { differenceField, showDifferences } from "./compareFields";
import { CompareFrame } from "./compareFrame";
import type { DiffSpan } from "./compareMarks";
import type { CompareRow } from "./compareStrip";
import { toDocPos } from "./docPos";
import { find } from "./find";

const LINE_PX = 20;
const TEXT = Array.from({ length: 40 }, (_, index) => `line ${index}`).join("\n");

type FakeColumn = {
  state: EditorState;
  dispatch(spec: TransactionSpec): void;
  readonly scrollDOM: EventTarget & { scrollTop: number; readonly clientHeight: number };
  readonly documentPadding: { readonly top: number };
  readonly documentTop: number;
  lineBlockAt(pos: number): Span;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeColumn(
  measured: { count: number },
  changed: (startState: EditorState, state: EditorState) => void,
): FakeColumn {
  const state = EditorState.create({ doc: TEXT, extensions: [differenceField, find] });
  const line = state.doc.line(5);
  const marks = { bands: Decoration.none, words: Decoration.none };
  const spans: readonly DiffSpan[] = [
    { from: toDocPos(line.from), to: toDocPos(line.to + 1), tone: "modified" },
  ];
  const column: FakeColumn = {
    state: state.update({ effects: showDifferences.of({ ...marks, spans }) }).state,
    dispatch(spec) {
      const startState = column.state;
      column.state = startState.update(spec).state;
      changed(startState, column.state);
    },
    scrollDOM: Object.assign(new EventTarget(), { scrollTop: 0, clientHeight: 10 * LINE_PX }),
    documentPadding: { top: 0 },
    documentTop: 0,
    lineBlockAt(pos) {
      measured.count += 1;
      const number = column.state.doc.lineAt(pos).number;
      return { top: (number - 1) * LINE_PX, bottom: number * LINE_PX };
    },
  };
  return column;
}

test("a scroll paints the strip from the cached rows; an edit measures them again", () => {
  const frames: (() => void)[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  function runFrames(): void {
    for (const frame of frames.splice(0)) {
      frame();
    }
  }
  const measured = { count: 0 };
  const painted: (readonly CompareRow[])[] = [];
  const holder: { frame: CompareFrame | null } = { frame: null };
  function changed(startState: EditorState, state: EditorState): void {
    holder.frame?.changed({ startState, state, geometryChanged: false });
  }
  const views = { left: fakeColumn(measured, changed), right: fakeColumn(measured, changed) };
  const frame = new CompareFrame({
    views,
    strip: {
      paint: (_panes, rows) => {
        painted.push(rows);
      },
    },
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
