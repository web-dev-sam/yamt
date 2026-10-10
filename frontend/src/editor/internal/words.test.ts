import { undo } from "@codemirror/commands";
import type { EditorState, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { createFixtureSource, log, type Chunk, type FileMergeData } from "../../ipc";
import { applySteps, dismissSteps, dispatchSteps, type ApplyTarget, type Steps } from "./apply";
import { chunkField, type ChunkSpan } from "./chunkField";
import { centerDecorations, sideDecorations } from "./decorations";
import { paneState } from "./pane";
import type { Side } from "./side";
import { showStatuses, sideStatusField } from "./sideStatus";
import type { ChunkState } from "./status";

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
    extensions: [statuses, sideDecorations(statuses, side)],
  });
}

function open(data: FileMergeData): Merge {
  const field = chunkField(data.chunks);
  const center = paneState({
    eol: data.eol,
    language: null,
    kind: "center",
    doc: data.base,
    extensions: [field, centerDecorations(field)],
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

function run(merge: Merge, steps: Steps): Merge {
  if (steps.length === 0) {
    throw new Error("expected a transaction");
  }
  let center = merge.center;
  dispatchSteps((spec) => {
    center = center.update(spec).state;
  }, steps);
  return mirrored(merge, center);
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

function target(merge: Merge): ApplyTarget {
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

function painted(state: EditorState): string[] {
  const found: string[] = [];
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source !== "function") {
      source.between(0, state.doc.length, (from, to, decoration) => {
        const text = from < to ? ` ${state.sliceDoc(from, to)}` : "";
        found.push(`${state.doc.lineAt(from).number} ${String(decoration.spec.class)}${text}`);
      });
    }
  }
  return found;
}

function marks(state: EditorState): string[] {
  return painted(state).filter((entry) => entry.includes("chunk-word-"));
}

test("side panes mark exactly the changed words, in a CRLF file and after an emoji", async () => {
  const merge = open(await synthetic());

  expect(marks(merge.left)).toEqual(["2 chunk-word-conflict mine", "3 chunk-word-modified 2"]);
  expect(marks(merge.right)).toEqual(["2 chunk-word-conflict theirs"]);
});

test("a resolved block loses its word marks on every side pane and undo brings them back", async () => {
  const start = open(await synthetic());

  const applied = run(
    start,
    applySteps({ target: target(start), chunk: chunk(start, MODIFIED), side: "local" }),
  );
  const dismissed = run(applied, dismissSteps(target(applied), chunk(applied, CONFLICT)));

  expect(marks(applied.left)).toEqual(["2 chunk-word-conflict mine"]);
  expect(marks(dismissed.left)).toEqual([]);
  expect(marks(dismissed.right)).toEqual([]);
  expect(marks(undone(dismissed).right)).toEqual(["2 chunk-word-conflict theirs"]);
  expect(marks(undone(undone(dismissed)).left)).toEqual(marks(start.left));
});

test("a half-applied conflict keeps its tint and its word marks together on both sides", async () => {
  const start = open(await synthetic());

  const applied = run(
    start,
    applySteps({ target: target(start), chunk: chunk(start, CONFLICT), side: "local" }),
  );

  expect(painted(applied.left)).toEqual([
    "2 chunk-conflict chunk-band",
    "3 chunk-modified chunk-band",
    "2 chunk-word-conflict mine",
    "3 chunk-word-modified 2",
  ]);
  expect(painted(applied.right)).toEqual([
    "2 chunk-conflict chunk-band",
    "2 chunk-word-conflict theirs",
  ]);
});

test("the middle pane tints its blocks without word marks: open, half-applied, applied, undone", async () => {
  const start = open(await synthetic());

  const halfApplied = run(
    start,
    applySteps({ target: target(start), chunk: chunk(start, CONFLICT), side: "local" }),
  );
  const applied = run(
    halfApplied,
    applySteps({ target: target(halfApplied), chunk: chunk(halfApplied, MODIFIED), side: "local" }),
  );
  const undoneOnce = undone(applied);
  const undoneTwice = undone(undoneOnce);

  expect(painted(start.center)).toEqual([
    "2 chunk-conflict chunk-band",
    "3 chunk-modified chunk-band",
  ]);
  expect(painted(halfApplied.center)).toEqual(painted(start.center));
  expect(painted(applied.center)).toEqual(["2 chunk-conflict chunk-band"]);
  expect(painted(undoneOnce.center)).toEqual(painted(start.center));
  expect(painted(undoneTwice.center)).toEqual(painted(start.center));
});

test("vueuse-use-magic-keys: a mark's colour follows its block's tone on both side panes", async () => {
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
});
