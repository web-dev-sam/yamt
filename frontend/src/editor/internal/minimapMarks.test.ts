import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { expect, test } from "vitest";

import type { Span } from "../../connectors";
import { loadFixture, type Chunk } from "../../ipc";
import type { ChunkRow } from "./geometry";
import { minimapColumns, minimapLayout, type MinimapInput } from "./minimapLayout";
import { changeMarks, markBoxes, problemMarks, type EdgeMark } from "./minimapMarks";
import { PENDING, type ChunkStatus } from "./status";

const LINE_PX = 20;
const LOCAL_APPLIED = 5;
const CONFLICT = 8;
const DOC = Array.from({ length: 60 }, (_, index) => `line ${index + 1}`).join("\n");
const WAVE = { first: 11, last: 40 };
const TALL: MinimapInput = {
  scrollTop: 72_770,
  viewportHeight: 900,
  paddingTop: 4,
  paddingBottom: 4,
  rows: 7277,
  height: 900,
  pixelRatio: 1,
};

function rowOf(chunk: Chunk, status: ChunkStatus): ChunkRow {
  function span(range: { start: number; len: number }): Span {
    return { top: range.start * LINE_PX, bottom: (range.start + range.len) * LINE_PX };
  }
  return {
    chunk,
    status,
    left: span(chunk.local),
    center: span(chunk.middle),
    right: span(chunk.remote),
  };
}

async function magicRows(): Promise<ChunkRow[]> {
  const data = await loadFixture("vueuse-use-magic-keys.ts");
  return data.chunks.map((chunk) => {
    if (chunk.id === LOCAL_APPLIED) {
      return rowOf(chunk, { local: "applied", remote: "pending" });
    }
    return rowOf(chunk, chunk.id === CONFLICT ? { local: "ignored", remote: "pending" } : PENDING);
  });
}

// Lines 11-40 are collapsed into one wave line at line 11's place.
function foldedBlockAt(state: EditorState): (pos: number) => Span {
  return (pos) => {
    const line = state.doc.lineAt(pos).number;
    if (line < WAVE.first) {
      return { top: (line - 1) * LINE_PX, bottom: line * LINE_PX };
    }
    if (line <= WAVE.last) {
      return { top: (WAVE.first - 1) * LINE_PX, bottom: WAVE.first * LINE_PX };
    }
    const shown = line - (WAVE.last - WAVE.first);
    return { top: (shown - 1) * LINE_PX, bottom: shown * LINE_PX };
  };
}

function withProblems(
  problems: readonly { from: number; to?: number; severity: Diagnostic["severity"] }[],
): EditorState {
  const state = EditorState.create({ doc: DOC });
  const diagnostics = problems.map(({ from, to = from, severity }) => ({
    from: state.doc.line(from).from,
    to: state.doc.line(to).from + 4,
    severity,
    message: "problem",
  }));
  return state.update(setDiagnostics(state, diagnostics)).state;
}

function rows(first: number, last: number): Pick<EdgeMark, "top" | "bottom"> {
  return { top: (first - 1) * LINE_PX, bottom: last * LINE_PX };
}

test("right edge: each change the Result tints, in its tone; resolved none", async () => {
  const shown = await magicRows();
  const waiting = shown.filter(({ chunk }) => chunk.id !== LOCAL_APPLIED);

  expect(changeMarks(shown).map(({ kind }) => kind)).toEqual([
    "modified",
    "modified",
    "modified",
    "inserted",
    "inserted",
    "modified",
    "modified",
    "conflict",
  ]);
  expect(changeMarks(shown).map(({ top, bottom }) => ({ top, bottom }))).toEqual(
    waiting.map(({ center }) => center),
  );
  expect(
    changeMarks(shown.map((row) => ({ ...row, status: { local: "applied", remote: "ignored" } }))),
  ).toEqual([]);
});

test("left edge: error and warning; info and hint none", () => {
  const state = withProblems([
    { from: 3, severity: "warning" },
    { from: 5, severity: "info" },
    { from: 7, severity: "hint" },
    { from: 9, severity: "error" },
  ]);

  expect(problemMarks(state, foldedBlockAt(state))).toEqual([
    { ...rows(3, 3), kind: "warning" },
    { ...rows(9, 9), kind: "error" },
  ]);
});

test("errors after warnings, so red is painted over yellow", () => {
  const state = withProblems([
    { from: 2, severity: "error" },
    { from: 4, severity: "warning" },
    { from: 50, severity: "error" },
    { from: 52, severity: "warning" },
  ]);

  expect(problemMarks(state, foldedBlockAt(state)).map(({ kind }) => kind)).toEqual([
    "warning",
    "warning",
    "error",
    "error",
  ]);
});

test("a problem in collapsed lines on its wave row", () => {
  const state = withProblems([
    { from: 30, severity: "error" },
    { from: 25, to: 45, severity: "warning" },
  ]);

  expect(problemMarks(state, foldedBlockAt(state))).toEqual([
    { ...rows(11, 16), kind: "warning" },
    { ...rows(11, 11), kind: "error" },
  ]);
});

test("minimum 4 CSS px, an insertion point centred, clamped", () => {
  // The window shows rows 3,435-3,884 two device px each: row 3,500 starts at 130 px.
  const layout = minimapLayout(TALL, null);
  const edge = minimapColumns(1).left;
  const marks: EdgeMark[] = [
    { ...rows(3500, 3500), kind: "error" },
    { top: 3499 * LINE_PX, bottom: 3499 * LINE_PX, kind: "deleted" },
    { ...rows(3500, 3509), kind: "modified" },
    { ...rows(3884, 3884), kind: "conflict" },
    { ...rows(3430, 3440), kind: "warning" },
  ];

  expect(markBoxes(marks, layout, edge)).toEqual([
    { x: 1, y: 129, width: 4, height: 4, kind: "error" },
    { x: 1, y: 128, width: 4, height: 4, kind: "deleted" },
    { x: 1, y: 130, width: 4, height: 20, kind: "modified" },
    { x: 1, y: 896, width: 4, height: 4, kind: "conflict" },
    { x: 1, y: 0, width: 4, height: 12, kind: "warning" },
  ]);
});

test("only marks in the window; through start row and padding", () => {
  const tall = minimapLayout(TALL, null);
  const padded = minimapLayout(
    { ...TALL, scrollTop: 0, rows: 30, paddingTop: 33, pixelRatio: 2 },
    null,
  );
  const marks: EdgeMark[] = [
    { ...rows(100, 100), kind: "error" },
    { ...rows(3436, 3436), kind: "warning" },
    { ...rows(3900, 3901), kind: "error" },
  ];

  expect(markBoxes(marks, tall, minimapColumns(1).right)).toEqual([
    { x: 127, y: 1, width: 4, height: 4, kind: "warning" },
  ]);
  expect(markBoxes([{ ...rows(1, 1), kind: "inserted" }], padded, minimapColumns(2).right)).toEqual(
    [{ x: 254, y: 2, width: 8, height: 8, kind: "inserted" }],
  );
});
