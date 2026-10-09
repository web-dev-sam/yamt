import { undo } from "@codemirror/commands";
import type { EditorState, StateField, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { createFixtureSource, log, type Chunk, type FileMergeData } from "../../ipc";
import { applySpec, dismissSpec } from "./apply";
import { chunkField, type ChunkSpan } from "./chunkField";
import { paneState } from "./pane";
import type { Side } from "./side";
import { showStatuses, sideStatusField } from "./sideStatus";
import type { ChunkState } from "./status";
import { centerWordMarks, sideWordMarks } from "./words";

type Columns = readonly [line: number, start: number, len: number];
type Merge = {
  readonly field: StateField<readonly ChunkSpan[]>;
  readonly center: EditorState;
  readonly left: EditorState;
  readonly right: EditorState;
};

const CONFLICT = 0;
const MODIFIED = 1;

function texts(word: string, value: string): string {
  return `keep\r\nconst 😀 = ${word};\r\na = ${value};\r\nend\r\n`;
}

function block(line: number): { start: number; len: number } {
  return { start: line, len: 1 };
}

function words(ranges: readonly Columns[]): object[] {
  return ranges.map(([line, start, len]) => ({ line, start, len }));
}

async function synthetic(): Promise<FileMergeData> {
  const record = {
    path: "synthetic.ts",
    base: texts("old", "1"),
    local: texts("mine", "2"),
    remote: texts("theirs", "1"),
    eol: "CrLf",
    chunks: [
      { id: CONFLICT, kind: "Conflict", base: block(1), local: block(1), remote: block(1) },
      { id: MODIFIED, kind: "LocalOnly", base: block(2), local: block(2), remote: block(2) },
    ],
    word_changes: [
      {
        chunk: CONFLICT,
        local: words([[1, 11, 4]]),
        base: words([[1, 11, 3]]),
        remote: words([[1, 11, 6]]),
      },
      { chunk: MODIFIED, local: words([[2, 4, 1]]), base: words([[2, 4, 1]]), remote: [] },
    ],
  };
  return createFixtureSource(log, { "synthetic.json": record }).loadFile("synthetic.ts");
}

function sidePane(
  data: FileMergeData,
  statuses: StateField<readonly ChunkState[]>,
  side: Side,
): EditorState {
  return paneState({
    eol: data.eol,
    language: null,
    kind: "side",
    doc: data[side],
    extensions: [statuses, sideWordMarks(statuses, side)],
  });
}

function open(data: FileMergeData): Merge {
  const field = chunkField(data.chunks);
  const center = paneState({
    eol: data.eol,
    language: null,
    kind: "center",
    doc: data.base,
    extensions: [field, centerWordMarks(field)],
  });
  const statuses = sideStatusField(
    center.field(field).map(({ chunk, status }) => ({ chunk, status })),
  );
  return {
    field,
    center,
    left: sidePane(data, statuses, "local"),
    right: sidePane(data, statuses, "remote"),
  };
}

function mirrored(merge: Merge, center: EditorState): Merge {
  const effects = showStatuses.of(
    center.field(merge.field).map(({ chunk, status }) => ({ chunk, status })),
  );
  return {
    ...merge,
    center,
    left: merge.left.update({ effects }).state,
    right: merge.right.update({ effects }).state,
  };
}

function run(merge: Merge, spec: TransactionSpec | null): Merge {
  if (spec === null) {
    throw new Error("expected a transaction");
  }
  return mirrored(merge, merge.center.update(spec).state);
}

function undone(merge: Merge): Merge {
  let center = merge.center;
  undo({
    state: center,
    dispatch: (tr) => {
      center = tr.state;
    },
  });
  return mirrored(merge, center);
}

function target(merge: Merge): Parameters<typeof applySpec>[0] {
  return {
    state: merge.center,
    field: merge.field,
    sides: { local: merge.left.doc, remote: merge.right.doc },
  };
}

function chunk(merge: Merge, id: number): Chunk {
  const span = merge.center.field(merge.field)[id];
  if (span === undefined) {
    throw new Error(`no chunk ${id}`);
  }
  return span.chunk;
}

function marks(state: EditorState): string[] {
  const found: string[] = [];
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source !== "function") {
      source.between(0, state.doc.length, (from, to, decoration) => {
        found.push(
          `${state.doc.lineAt(from).number} ${String(decoration.spec.class)} ${state.sliceDoc(from, to)}`,
        );
      });
    }
  }
  return found;
}

test("side panes mark exactly the changed words, in a CRLF file and after an emoji", async () => {
  const merge = open(await synthetic());

  expect(marks(merge.left)).toEqual(["2 chunk-word-conflict mine", "3 chunk-word-modified 2"]);
  expect(marks(merge.right)).toEqual(["2 chunk-word-conflict theirs"]);
});

test("a resolved block loses its word marks on every pane and undo brings them back", async () => {
  const start = open(await synthetic());

  const applied = run(start, applySpec(target(start), chunk(start, MODIFIED), "local"));
  const dismissed = run(applied, dismissSpec(target(applied), chunk(applied, CONFLICT)));

  expect(marks(applied.left)).toEqual(["2 chunk-word-conflict mine"]);
  expect(marks(dismissed.left)).toEqual([]);
  expect(marks(dismissed.right)).toEqual([]);
  expect(marks(dismissed.center)).toEqual([]);
  expect(marks(undone(dismissed).right)).toEqual(["2 chunk-word-conflict theirs"]);
  expect(marks(undone(dismissed).center)).toEqual(["2 chunk-word-conflict old"]);
  expect(marks(undone(undone(dismissed)).left)).toEqual(marks(start.left));
});

test("middle pane marks an open conflict's base words until a side is applied; undo restores them", async () => {
  const start = open(await synthetic());

  const applied = run(start, applySpec(target(start), chunk(start, CONFLICT), "local"));

  expect(marks(start.center)).toEqual(["2 chunk-word-conflict old", "3 chunk-word-modified 1"]);
  expect(applied.center.field(applied.field)[CONFLICT]?.status).toBe("applied-local");
  expect(marks(applied.center)).toEqual(["3 chunk-word-modified 1"]);
  expect(marks(undone(applied).center)).toEqual(marks(start.center));
});

test("middle pane: typing inside a block hides its marks, typing a line above moves them", async () => {
  const start = open(await synthetic());
  const conflictLine = start.center.doc.line(2);

  const inside = run(start, { changes: { from: conflictLine.to, insert: " // x" } });
  const above = run(start, { changes: { from: 0, insert: "// top\r\n" } });

  expect(marks(inside.center)).toEqual(["3 chunk-word-modified 1"]);
  expect(marks(undone(inside).center)).toEqual(marks(start.center));
  expect(marks(above.center)).toEqual(["3 chunk-word-conflict old", "4 chunk-word-modified 1"]);
});

test("vueuse-use-magic-keys: a mark's colour follows its block's tone on every pane", async () => {
  const merge = open(await createFixtureSource(log).loadFile("vueuse-use-magic-keys.ts"));
  function tonesByLine(state: EditorState): string[] {
    return [...new Set(marks(state).map((mark) => mark.split(" ", 2).join(" ")))];
  }

  expect(tonesByLine(merge.left)).toEqual([
    "3 chunk-word-modified",
    "22 chunk-word-modified",
    "54 chunk-word-modified",
    "103 chunk-word-modified",
    "105 chunk-word-modified",
    "107 chunk-word-modified",
    "115 chunk-word-modified",
    "130 chunk-word-conflict",
    "131 chunk-word-conflict",
    "132 chunk-word-conflict",
    "133 chunk-word-conflict",
    "134 chunk-word-conflict",
    "135 chunk-word-conflict",
    "136 chunk-word-conflict",
  ]);
  expect(marks(merge.right).slice(-2)).toEqual([
    "152 chunk-word-conflict     useEventListener('blur', reset, { passive: true })",
    "153 chunk-word-conflict     useEventListener('focus', reset, { passive: true })",
  ]);
  expect(marks(merge.center)).toContain("129 chunk-word-conflict if (target) {");
  expect(tonesByLine(merge.center).at(0)).toBe("3 chunk-word-modified");
});
