import { history, redo, undo } from "@codemirror/commands";
import { EditorState, type StateCommand, type TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { createFixtureSource, log, type Chunk, type FileMergeData } from "../../ipc";
import { applyAllNonConflicting, applyChunk, dismissChunk, type ApplyTarget } from "./apply";
import { chunkField } from "./chunkField";
import { centerDecorations } from "./decorations";
import { lineSpan } from "./lineSpan";
import { eolSeparator } from "./pane";
import type { Side } from "./side";
import { summarize, type ChunkStatus } from "./status";
import { gapArrows } from "./strips";

const MAGIC_KEYS = "vueuse-use-magic-keys.ts";

async function synthetic(
  texts: { base: string; local: string; remote: string; eol: FileMergeData["eol"] },
  chunk: { kind: Chunk["kind"]; base: [number, number]; side: [number, number] },
): Promise<FileMergeData> {
  const record = {
    path: "synthetic.ts",
    ...texts,
    language: null,
    chunks: [
      {
        id: 0,
        kind: chunk.kind,
        base: { start: chunk.base[0], len: chunk.base[1] },
        local: { start: chunk.side[0], len: chunk.side[1] },
        remote: { start: chunk.side[0], len: chunk.side[1] },
      },
    ],
  };
  return createFixtureSource(log, { "synthetic.json": record }).loadFile("synthetic.ts");
}

function open(data: FileMergeData): ApplyTarget {
  const field = chunkField(data.chunks);
  const separator = eolSeparator(data.eol);
  return {
    state: EditorState.create({
      doc: data.base,
      extensions: [separator, history(), field, centerDecorations(field)],
    }),
    field,
    sides: {
      local: EditorState.create({ doc: data.local, extensions: separator }).doc,
      remote: EditorState.create({ doc: data.remote, extensions: separator }).doc,
    },
  };
}

async function magicKeys(): Promise<ApplyTarget> {
  return open(await createFixtureSource(log).loadFile(MAGIC_KEYS));
}

function chunkAt(merge: ApplyTarget, id: number): Chunk {
  const span = merge.state.field(merge.field)[id];
  if (span === undefined) {
    throw new Error(`no chunk ${id}`);
  }
  return span.chunk;
}

function run(merge: ApplyTarget, spec: TransactionSpec | null): ApplyTarget {
  if (spec === null) {
    throw new Error("expected a transaction");
  }
  return { ...merge, state: merge.state.update(spec).state };
}

function command(merge: ApplyTarget, cmd: StateCommand): ApplyTarget {
  let next = merge;
  cmd({
    state: merge.state,
    dispatch: (tr) => {
      next = { ...merge, state: tr.state };
    },
  });
  return next;
}

function statuses(merge: ApplyTarget): ChunkStatus[] {
  return merge.state.field(merge.field).map((span) => span.status);
}

function centerText(merge: ApplyTarget, id: number): string {
  const span = merge.state.field(merge.field)[id];
  return span === undefined ? "" : merge.state.sliceDoc(span.from, span.to);
}

function sideText(merge: ApplyTarget, id: number, side: Side): string {
  const doc = merge.sides[side];
  const { from, to } = lineSpan(doc, chunkAt(merge, id)[side]);
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
  return [...lines];
}

function arrowLines(merge: ApplyTarget, side: Side): number[] {
  const rows = merge.state.field(merge.field).map((span) => ({
    ...span,
    left: { top: span.chunk.local.start + 1, bottom: 0 },
    center: { top: 0, bottom: 0 },
    right: { top: span.chunk.remote.start + 1, bottom: 0 },
  }));
  return gapArrows(rows, side).map((arrow) => arrow.top);
}

test("apply local: the change gets the left text, resolves, and loses colour and arrow", async () => {
  const start = await magicKeys();

  const applied = run(start, applyChunk(start, chunkAt(start, 0), "local"));

  expect(centerText(applied, 0)).toBe(sideText(applied, 0, "local"));
  expect(centerText(applied, 0)).not.toBe(centerText(start, 0));
  expect(statuses(applied)[0]).toBe("applied-local");
  expect(decoratedLines(start.state)).toContain(3);
  expect(decoratedLines(applied.state)).not.toContain(3);
  expect(arrowLines(start, "local")).toContain(3);
  expect(arrowLines(applied, "local")).not.toContain(3);
  expect(summarize(start.state.field(start.field))).toEqual({ changes: 8, conflicts: 1 });
  expect(summarize(applied.state.field(applied.field))).toEqual({ changes: 7, conflicts: 1 });
  expect(applyChunk(applied, chunkAt(applied, 0), "local")).toBeNull();
  expect(applyChunk(start, chunkAt(start, 0), "remote")).toBeNull();
});

test("apply remote inserts the right lines at an empty base range", async () => {
  const start = await magicKeys();

  const applied = run(start, applyChunk(start, chunkAt(start, 3), "remote"));

  expect(centerText(applied, 3)).toBe(sideText(applied, 3, "remote"));
  expect(applied.state.doc.lines).toBe(start.state.doc.lines + 1);
  expect(statuses(applied)[3]).toBe("applied-remote");
  expect(arrowLines(applied, "remote")).not.toContain(arrowLines(start, "remote")[0]);
});

test("a conflict applied from both sides holds local then remote text", async () => {
  const start = await magicKeys();
  const conflict = chunkAt(start, 8);

  const local = run(start, applyChunk(start, conflict, "local"));
  const both = run(local, applyChunk(local, conflict, "remote"));

  expect(statuses(local)[8]).toBe("applied-local");
  expect(summarize(local.state.field(local.field))).toEqual({ changes: 8, conflicts: 1 });
  expect(arrowLines(local, "local")).not.toContain(129);
  expect(arrowLines(local, "remote")).toContain(141);
  expect(decoratedLines(local.state)).toContain(129);
  expect(centerText(both, 8)).toBe(sideText(both, 8, "local") + sideText(both, 8, "remote"));
  expect(statuses(both)[8]).toBe("applied-both");
  expect(summarize(both.state.field(both.field))).toEqual({ changes: 8, conflicts: 0 });
  expect(arrowLines(both, "remote")).not.toContain(141);
  expect(decoratedLines(both.state)).not.toContain(129);
});

test("ignore keeps the text and resolves a change or a half-applied conflict", async () => {
  const start = await magicKeys();

  const ignored = run(start, dismissChunk(start, chunkAt(start, 1)));
  const half = run(ignored, applyChunk(ignored, chunkAt(ignored, 8), "remote"));
  const settled = run(half, dismissChunk(half, chunkAt(half, 8)));

  expect(ignored.state.doc.toString()).toBe(start.state.doc.toString());
  expect(statuses(ignored)[1]).toBe("dismissed");
  expect(decoratedLines(ignored.state)).not.toContain(22);
  expect(arrowLines(ignored, "local")).not.toContain(22);
  expect(centerText(settled, 8)).toBe(sideText(settled, 8, "remote"));
  expect(statuses(settled)[8]).toBe("dismissed");
  expect(summarize(settled.state.field(settled.field))).toEqual({ changes: 7, conflicts: 0 });
  expect(dismissChunk(settled, chunkAt(settled, 8))).toBeNull();
});

test("applying after an edit inside the change replaces the current range", async () => {
  const start = await magicKeys();
  const line = start.state.doc.line(3);
  const typed = {
    ...start,
    state: start.state.update({ changes: { from: line.to, insert: "\n// mine" } }).state,
  };

  const applied = run(typed, applyChunk(typed, chunkAt(typed, 0), "local"));

  expect(centerText(typed, 0)).toContain("// mine");
  expect(centerText(applied, 0)).toBe(sideText(applied, 0, "local"));
  expect(applied.state.doc.lines).toBe(start.state.doc.lines);
});

test("undo after apply restores text and status; redo re-applies", async () => {
  const start = await magicKeys();
  const applied = run(start, applyChunk(start, chunkAt(start, 0), "local"));

  const undone = command(applied, undo);
  const redone = command(undone, redo);

  expect(undone.state.doc.toString()).toBe(start.state.doc.toString());
  expect(statuses(undone)[0]).toBe("pending");
  expect(decoratedLines(undone.state)).toContain(3);
  expect(redone.state.doc.toString()).toBe(applied.state.doc.toString());
  expect(statuses(redone)[0]).toBe("applied-local");
});

test("undo after ignore brings the change back; redo ignores it again", async () => {
  const start = await magicKeys();
  const ignored = run(start, dismissChunk(start, chunkAt(start, 1)));

  const undone = command(ignored, undo);
  const redone = command(undone, redo);

  expect(statuses(undone)[1]).toBe("pending");
  expect(statuses(redone)[1]).toBe("dismissed");
});

test("bulk apply from the left resolves every LocalOnly change; one undo restores all", async () => {
  const start = await magicKeys();

  const bulk = run(start, applyAllNonConflicting(start, "local"));
  const undone = command(bulk, undo);

  expect(statuses(bulk)).toEqual([
    "applied-local",
    "applied-local",
    "applied-local",
    "pending",
    "pending",
    "applied-local",
    "pending",
    "applied-local",
    "pending",
  ]);
  for (const id of [0, 1, 2, 5, 7]) {
    expect(centerText(bulk, id)).toBe(sideText(bulk, id, "local"));
  }
  expect(summarize(bulk.state.field(bulk.field))).toEqual({ changes: 3, conflicts: 1 });
  expect(applyAllNonConflicting(bulk, "local")).toBeNull();
  expect(undone.state.doc.toString()).toBe(start.state.doc.toString());
  expect(statuses(undone)).toEqual(statuses(start));
});

test("a BothSame change resolves from either arrow and from either bulk apply", async () => {
  const merge = open(
    await synthetic(
      { base: "a\nb\nc\n", local: "a\nB\nc\n", remote: "a\nB\nc\n", eol: "Lf" },
      { kind: "BothSame", base: [1, 1], side: [1, 1] },
    ),
  );
  const same = chunkAt(merge, 0);

  const fromRight = run(merge, applyChunk(merge, same, "remote"));
  const bulkLeft = run(merge, applyAllNonConflicting(merge, "local"));
  const bulkRight = run(merge, applyAllNonConflicting(merge, "remote"));

  expect(arrowLines(merge, "local")).toEqual([2]);
  expect(arrowLines(merge, "remote")).toEqual([2]);
  expect(fromRight.state.sliceDoc()).toBe("a\nB\nc\n");
  expect(arrowLines(fromRight, "local")).toEqual([]);
  expect(summarize(fromRight.state.field(fromRight.field))).toEqual({ changes: 0, conflicts: 0 });
  expect(statuses(bulkLeft)).toEqual(["applied-local"]);
  expect(statuses(bulkRight)).toEqual(["applied-remote"]);
  expect(bulkRight.state.sliceDoc()).toBe("a\nB\nc\n");
});

test("bulk apply from the right inserts every RemoteOnly change in place", async () => {
  const start = await magicKeys();

  const bulk = run(start, applyAllNonConflicting(start, "remote"));

  for (const id of [3, 4, 6]) {
    expect(statuses(bulk)[id]).toBe("applied-remote");
    expect(centerText(bulk, id)).toBe(sideText(bulk, id, "remote"));
  }
  expect(summarize(bulk.state.field(bulk.field))).toEqual({ changes: 5, conflicts: 1 });
});

test("deleting all of a change's lines in the middle pane ignores it", async () => {
  const start = await magicKeys();
  const line = start.state.doc.line(3);

  const deleted = {
    ...start,
    state: start.state.update({ changes: { from: line.from, to: line.to + 1 } }).state,
  };

  expect(statuses(deleted)[0]).toBe("dismissed");
  expect(summarize(deleted.state.field(deleted.field))).toEqual({ changes: 7, conflicts: 1 });
  expect(statuses(command(deleted, undo))[0]).toBe("pending");
});

test("resultText of a CRLF file keeps CRLF after an apply", async () => {
  const merge = open(
    await synthetic(
      { base: "a\r\nb\r\nc\r\n", local: "a\r\nB\r\nc\r\n", remote: "a\r\nb\r\nc\r\n", eol: "CrLf" },
      { kind: "LocalOnly", base: [1, 1], side: [1, 1] },
    ),
  );

  const applied = run(merge, applyChunk(merge, chunkAt(merge, 0), "local"));

  expect(applied.state.sliceDoc()).toBe("a\r\nB\r\nc\r\n");
});

test("a change on an unterminated last line keeps the file without a final line break", async () => {
  const cases = [
    { base: "a\nb", local: "a\nB", chunk: { base: [1, 1], side: [1, 1] }, result: "a\nB" },
    { base: "a\nb", local: "a", chunk: { base: [1, 1], side: [1, 0] }, result: "a" },
    { base: "a", local: "a\nb", chunk: { base: [1, 0], side: [1, 1] }, result: "a\nb" },
  ] satisfies {
    base: string;
    local: string;
    chunk: { base: [number, number]; side: [number, number] };
    result: string;
  }[];

  for (const { base, local, chunk, result } of cases) {
    const merge = open(
      await synthetic({ base, local, remote: base, eol: "Lf" }, { kind: "LocalOnly", ...chunk }),
    );
    const applied = run(merge, applyChunk(merge, chunkAt(merge, 0), "local"));
    expect(applied.state.sliceDoc()).toBe(result);
  }
});
