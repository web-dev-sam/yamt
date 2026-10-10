import { redo, undo } from "@codemirror/commands";
import type { EditorState, StateCommand, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { loadFixture, type Chunk, type FileMergeData } from "../../ipc";
import { applySteps, dispatchSteps, ignoreSteps, type ApplyTarget } from "./apply";
import { chunkField, type ChunkSpan } from "./chunkField";
import { centerDecorations, sideDecorations } from "./decorations";
import { lineSpan } from "./lineSpan";
import { paneState } from "./pane";
import type { Side } from "./side";
import { showStatuses, sideStatusField } from "./sideStatus";
import { summarize, type ApplyMode, type MergeSummary, type SideStatus } from "./status";
import { gapArrows } from "./strips";

type Merge = {
  readonly field: StateField<readonly ChunkSpan[]>;
  readonly center: EditorState;
  readonly left: EditorState;
  readonly right: EditorState;
};
type Click = { readonly kind: "apply" | "ignore"; readonly side: Side };
type Range = [start: number, len: number];
type Lines = { readonly first: number; readonly last: number };

const MAGIC_KEYS = "vueuse-use-magic-keys.ts";
const CONFLICT = 8;
const LOCAL_ONLY = 0;
const CONFLICT_LEFT_LINES: Lines = { first: 129, last: 136 };
const CONFLICT_MIDDLE_LINES: Lines = { first: 129, last: 138 };
const CONFLICT_RIGHT_LINES: Lines = { first: 141, last: 154 };

async function synthetic(
  texts: { base: string; local: string; remote: string },
  chunks: readonly { kind: Chunk["kind"]; base: Range; local: Range; remote: Range }[],
): Promise<FileMergeData> {
  const record = {
    path: "synthetic.ts",
    ...texts,
    eol: "Lf",
    chunks: chunks.map(({ kind, base, local, remote }, id) => ({
      id,
      kind,
      base: { start: base[0], len: base[1] },
      local: { start: local[0], len: local[1] },
      remote: { start: remote[0], len: remote[1] },
    })),
    word_changes: chunks.map((_chunk, id) => ({
      chunk: id,
      local: { changed: [], removed_at: [] },
      remote: { changed: [], removed_at: [] },
    })),
  };
  return loadFixture("synthetic.ts", { "synthetic.json": record });
}

function open(data: FileMergeData): Merge {
  const field = chunkField(data.chunks);
  const pane = { eol: data.eol, language: null };
  const center = paneState({
    ...pane,
    kind: "center",
    doc: data.base,
    extensions: [field, centerDecorations(field)],
  });
  const statuses = sideStatusField(
    center.field(field).map(({ chunk, status }) => ({ chunk, status })),
  );
  function side(which: Side): EditorState {
    const extensions = [statuses, sideDecorations(statuses, which)];
    return paneState({ ...pane, kind: "side", doc: data[which], extensions });
  }
  return { field, center, left: side("local"), right: side("remote") };
}

async function magicKeys(): Promise<Merge> {
  return open(await loadFixture(MAGIC_KEYS));
}

function mirrored(merge: Merge, center: EditorState): Merge {
  const spans = center.field(merge.field).map(({ chunk, status }) => ({ chunk, status }));
  const effects = showStatuses.of(spans);
  return {
    ...merge,
    center,
    left: merge.left.update({ effects }).state,
    right: merge.right.update({ effects }).state,
  };
}

function spanAt(merge: Merge, id: number): ChunkSpan {
  const span = merge.center.field(merge.field)[id];
  if (span === undefined) {
    throw new Error(`no chunk ${id}`);
  }
  return span;
}

function click(merge: Merge, id: number, { kind, side }: Click): Merge {
  const sides = { local: merge.left.doc, remote: merge.right.doc };
  const target: ApplyTarget = { state: merge.center, field: merge.field, sides };
  const request = { target, chunk: spanAt(merge, id).chunk, side };
  const steps = kind === "apply" ? applySteps(request) : ignoreSteps(request);
  if (steps.length === 0) {
    throw new Error("expected a transaction");
  }
  let center = merge.center;
  dispatchSteps((spec) => {
    center = center.update(spec).state;
  }, steps);
  return mirrored(merge, center);
}

function history(merge: Merge, command: StateCommand): Merge {
  let center = merge.center;
  const ran = command({
    state: center,
    dispatch: (tr) => {
      center = tr.state;
    },
  });
  if (!ran) {
    throw new Error("nothing to undo or redo");
  }
  return mirrored(merge, center);
}

function status(merge: Merge, id: number): `${SideStatus} ${SideStatus}` {
  const { local, remote } = spanAt(merge, id).status;
  return `${local} ${remote}`;
}

function summary(merge: Merge): MergeSummary {
  return summarize(merge.center.field(merge.field));
}

function centerText(merge: Merge, id: number): string {
  const { from, to } = spanAt(merge, id);
  return merge.center.sliceDoc(from, to);
}

function sideText(merge: Merge, id: number, side: Side): string {
  const doc = side === "local" ? merge.left.doc : merge.right.doc;
  const { from, to } = lineSpan(doc, spanAt(merge, id).chunk[side]);
  return doc.sliceString(from, to);
}

function decoratedLines(state: EditorState): number[] {
  const lines = new Set<number>();
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source !== "function") {
      source.between(0, state.doc.length, (from) => {
        lines.add(state.doc.lineAt(from).number);
      });
    }
  }
  return [...lines].toSorted((a, b) => a - b);
}

function outside(lines: readonly number[], { first, last }: Lines): number[] {
  return lines.filter((line) => line < first || line > last);
}

function arrows(merge: Merge, side: Side): ReadonlyMap<number, ApplyMode> {
  const rows = merge.center.field(merge.field).map((span) => ({
    ...span,
    left: { top: span.chunk.local.start + 1, bottom: 0 },
    center: { top: 0, bottom: 0 },
    right: { top: span.chunk.remote.start + 1, bottom: 0 },
  }));
  return new Map(gapArrows(rows, side).map(({ top, mode }) => [top, mode]));
}

function expectOneUndoStep(before: Merge, after: Merge): void {
  const ids = before.center.field(before.field).map((span) => span.chunk.id);
  const undone = history(after, undo);
  const redone = history(undone, redo);
  const pairs: readonly (readonly [Merge, Merge])[] = [
    [undone, before],
    [redone, after],
  ];
  for (const [restored, expected] of pairs) {
    expect(restored.center.doc.toString()).toBe(expected.center.doc.toString());
    expect(ids.map((id) => status(restored, id))).toEqual(ids.map((id) => status(expected, id)));
    expect(decoratedLines(restored.left)).toEqual(decoratedLines(expected.left));
    expect(decoratedLines(restored.right)).toEqual(decoratedLines(expected.right));
    expect(decoratedLines(restored.center)).toEqual(decoratedLines(expected.center));
  }
}

test("× on a conflict's left side keeps the middle and the right side; « then replaces the middle", async () => {
  const start = await magicKeys();

  const ignored = click(start, CONFLICT, { kind: "ignore", side: "local" });
  const replaced = click(ignored, CONFLICT, { kind: "apply", side: "remote" });

  expect(ignored.center.doc.toString()).toBe(start.center.doc.toString());
  expect(status(ignored, CONFLICT)).toBe("ignored pending");
  expect(decoratedLines(ignored.left)).toEqual(
    outside(decoratedLines(start.left), CONFLICT_LEFT_LINES),
  );
  expect(decoratedLines(ignored.right)).toEqual(decoratedLines(start.right));
  expect(arrows(start, "local").get(129)).toBe("replace");
  expect(arrows(ignored, "local").get(129)).toBeUndefined();
  expect(arrows(ignored, "remote").get(141)).toBe("replace");
  expect(decoratedLines(ignored.center)).toEqual(decoratedLines(start.center));
  expect(summary(ignored)).toEqual({ changes: 8, conflicts: 1 });
  expect(centerText(replaced, CONFLICT)).toBe(sideText(replaced, CONFLICT, "remote"));
  expect(status(replaced, CONFLICT)).toBe("ignored applied");
  expect(arrows(replaced, "remote").get(141)).toBeUndefined();
  expect(decoratedLines(replaced.center)).toEqual(
    outside(decoratedLines(start.center), CONFLICT_MIDDLE_LINES),
  );
  expect(summary(replaced)).toEqual({ changes: 8, conflicts: 0 });
  expectOneUndoStep(start, ignored);
  expectOneUndoStep(ignored, replaced);
});

test("» then « on a conflict appends; the right arrow offers that only while the left side is applied", async () => {
  const start = await magicKeys();

  const left = click(start, CONFLICT, { kind: "apply", side: "local" });
  const both = click(left, CONFLICT, { kind: "apply", side: "remote" });
  const ignored = click(start, CONFLICT, { kind: "ignore", side: "local" });

  expect(arrows(start, "remote").get(141)).toBe("replace");
  expect(arrows(left, "remote").get(141)).toBe("append");
  expect(arrows(left, "local").get(129)).toBeUndefined();
  expect(decoratedLines(left.right)).toEqual(decoratedLines(start.right));
  expect(arrows(ignored, "remote").get(141)).toBe("replace");
  expect(centerText(both, CONFLICT)).toBe(
    sideText(both, CONFLICT, "local") + sideText(both, CONFLICT, "remote"),
  );
  expect(status(both, CONFLICT)).toBe("applied applied");
  expect(summary(both)).toEqual({ changes: 8, conflicts: 0 });
  expectOneUndoStep(start, left);
  expectOneUndoStep(left, both);
});

test("applying a side of a conflict whose other side deleted the block resolves it whole", async () => {
  const texts = { base: "a\nb\nc\n", local: "a\nc\n", remote: "a\nB\nc\n" };
  const start = open(
    await synthetic(texts, [{ kind: "Conflict", base: [1, 1], local: [1, 0], remote: [1, 1] }]),
  );

  const applied = click(start, 0, { kind: "apply", side: "remote" });

  expect(applied.center.sliceDoc()).toBe("a\nB\nc\n");
  expect(status(applied, 0)).toBe("ignored applied");
  expect(summary(applied)).toEqual({ changes: 0, conflicts: 0 });
  expect(decoratedLines(applied.center)).toEqual([]);
  expectOneUndoStep(start, applied);
});

test("× and apply on a block that is not a conflict resolve the whole block", async () => {
  const magic = await magicKeys();
  const texts = { base: "a\nb\nc\n", local: "a\nB\nc\n", remote: "a\nB\nc\n" };
  const same = open(
    await synthetic(texts, [{ kind: "BothSame", base: [1, 1], local: [1, 1], remote: [1, 1] }]),
  );

  const oneSided = click(magic, LOCAL_ONLY, { kind: "ignore", side: "local" });
  const sameIgnored = click(same, 0, { kind: "ignore", side: "remote" });
  const sameApplied = click(same, 0, { kind: "apply", side: "local" });

  expect(status(oneSided, LOCAL_ONLY)).toBe("ignored pending");
  expect(summary(oneSided)).toEqual({ changes: 7, conflicts: 1 });
  expect(status(sameIgnored, 0)).toBe("ignored ignored");
  expect(sameIgnored.center.sliceDoc()).toBe("a\nb\nc\n");
  expect(status(sameApplied, 0)).toBe("applied applied");
  expect(sameApplied.center.sliceDoc()).toBe("a\nB\nc\n");
  for (const resolved of [sameIgnored, sameApplied]) {
    expect([...arrows(resolved, "local"), ...arrows(resolved, "remote")]).toEqual([]);
    expect(decoratedLines(resolved.left)).toEqual([]);
    expect(decoratedLines(resolved.right)).toEqual([]);
    expect(summary(resolved)).toEqual({ changes: 0, conflicts: 0 });
  }
  expectOneUndoStep(magic, oneSided);
  expectOneUndoStep(same, sameIgnored);
  expectOneUndoStep(same, sameApplied);
});

test("deleting a whole open or half-applied conflict in the middle pane ignores every side", async () => {
  const fresh = await magicKeys();
  const halfApplied = click(fresh, CONFLICT, { kind: "apply", side: "local" });

  for (const start of [fresh, halfApplied]) {
    const { from, to } = spanAt(start, CONFLICT);
    const deleted = mirrored(start, start.center.update({ changes: { from, to } }).state);

    expect(status(deleted, CONFLICT)).toBe("ignored ignored");
    expect(summary(deleted)).toEqual({ changes: 8, conflicts: 0 });
    expect(arrows(deleted, "remote").get(141)).toBeUndefined();
    expect(decoratedLines(deleted.right)).toEqual(
      outside(decoratedLines(start.right), CONFLICT_RIGHT_LINES),
    );
    expectOneUndoStep(start, deleted);
  }
});
