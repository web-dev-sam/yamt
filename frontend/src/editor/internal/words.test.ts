import { undo } from "@codemirror/commands";
import type { EditorState, StateField } from "@codemirror/state";
import { EditorView, WidgetType } from "@codemirror/view";
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
type Point = readonly [line: number, column: number];
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

function words(ranges: readonly Columns[], points: readonly Point[]): object {
  return {
    changed: ranges.map(([line, start, len]) => ({ line, start, len })),
    removed_at: points.map(([line, column]) => ({ line, column })),
  };
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
        local: words(
          [[1, 11, 4]],
          [
            [1, 0],
            [1, 16],
          ],
        ),
        remote: words([[1, 11, 6]], [[1, 8]]),
      },
      { chunk: MODIFIED, local: words([[2, 4, 1]], [[2, 5]]), remote: words([], []) },
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
        const line = state.doc.lineAt(from);
        if (decoration.spec.widget === undefined) {
          const text = from < to ? ` ${state.sliceDoc(from, to)}` : "";
          found.push(`${line.number} ${String(decoration.spec.class)}${text}`);
        } else {
          const className = String(decoration.spec.widget.className);
          const around = `${state.sliceDoc(line.from, from)}|${state.sliceDoc(from, line.to)}`;
          found.push(`${line.number} ${className} ${around}`);
        }
      });
    }
  }
  return found;
}

function marks(state: EditorState): string[] {
  return painted(state).filter((entry) => entry.includes("chunk-word-"));
}

function bars(state: EditorState): string[] {
  return painted(state).filter((entry) => entry.includes("chunk-removal-"));
}

function barPositions(state: EditorState): number[] {
  const found: number[] = [];
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source !== "function") {
      source.between(0, state.doc.length, (from, _to, decoration) => {
        if (decoration.spec.widget !== undefined) {
          found.push(from);
        }
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

test("side panes draw one bar per removal point in a CRLF file: line start, mid-line, line end", async () => {
  const merge = open(await synthetic());

  expect(bars(merge.left)).toEqual([
    "2 chunk-removal chunk-removal-conflict |const 😀 = mine;",
    "2 chunk-removal chunk-removal-conflict const 😀 = mine;|",
    "3 chunk-removal chunk-removal-modified a = 2|;",
  ]);
  expect(bars(merge.right)).toEqual(["2 chunk-removal chunk-removal-conflict const 😀| = theirs;"]);
  expect(barPositions(merge.left)).toEqual([5, 21, 27]);
  expect(barPositions(merge.right)).toEqual([13]);
});

test("a bar equals another pane's bar of the same tone and differs from a bar of another tone", async () => {
  const merge = open(await synthetic());
  function widgets(state: EditorState): WidgetType[] {
    const found: WidgetType[] = [];
    for (const source of state.facet(EditorView.decorations)) {
      if (typeof source !== "function") {
        source.between(0, state.doc.length, (_from, _to, decoration) => {
          const widget: unknown = decoration.spec.widget;
          if (widget instanceof WidgetType) {
            found.push(widget);
          }
        });
      }
    }
    return found;
  }
  const [leftConflict, , leftModified] = widgets(merge.left);
  const [rightConflict] = widgets(merge.right);
  if (leftConflict === undefined || leftModified === undefined || rightConflict === undefined) {
    throw new Error("missing bars");
  }

  expect(leftConflict.eq(rightConflict)).toBe(true);
  expect(leftConflict.eq(leftModified)).toBe(false);
});

test("a resolved block loses its word marks and bars on every side pane and undo brings them back", async () => {
  const start = open(await synthetic());

  const applied = run(
    start,
    applySteps({ target: target(start), chunk: chunk(start, MODIFIED), side: "local" }),
  );
  const dismissed = run(applied, dismissSteps(target(applied), chunk(applied, CONFLICT)));

  expect(marks(applied.left)).toEqual(["2 chunk-word-conflict mine"]);
  expect(bars(applied.left)).toEqual([
    "2 chunk-removal chunk-removal-conflict |const 😀 = mine;",
    "2 chunk-removal chunk-removal-conflict const 😀 = mine;|",
  ]);
  expect(marks(dismissed.left)).toEqual([]);
  expect(marks(dismissed.right)).toEqual([]);
  expect(bars(dismissed.left)).toEqual([]);
  expect(bars(dismissed.right)).toEqual([]);
  expect(marks(undone(dismissed).right)).toEqual(["2 chunk-word-conflict theirs"]);
  expect(bars(undone(dismissed).right)).toEqual([
    "2 chunk-removal chunk-removal-conflict const 😀| = theirs;",
  ]);
  expect(painted(undone(undone(dismissed)).left)).toEqual(painted(start.left));
});

test("a half-applied conflict keeps its tint, word marks and removal bars together on both sides", async () => {
  const start = open(await synthetic());

  const applied = run(
    start,
    applySteps({ target: target(start), chunk: chunk(start, CONFLICT), side: "local" }),
  );

  expect(painted(applied.left)).toEqual([
    "2 chunk-conflict chunk-band",
    "3 chunk-modified chunk-band",
    "2 chunk-removal chunk-removal-conflict |const 😀 = mine;",
    "2 chunk-word-conflict mine",
    "2 chunk-removal chunk-removal-conflict const 😀 = mine;|",
    "3 chunk-word-modified 2",
    "3 chunk-removal chunk-removal-modified a = 2|;",
  ]);
  expect(painted(applied.right)).toEqual([
    "2 chunk-conflict chunk-band",
    "2 chunk-removal chunk-removal-conflict const 😀| = theirs;",
    "2 chunk-word-conflict theirs",
  ]);
});

test("the middle pane tints its blocks without word marks or bars: open, half-applied, applied, undone", async () => {
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
    "129 chunk-word-conflict",
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
