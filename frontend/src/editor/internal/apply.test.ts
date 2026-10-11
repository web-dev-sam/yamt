import { indentMore, insertNewlineAndIndent, redo, undo, undoDepth } from "@codemirror/commands";
import { Transaction, type EditorState, type StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { loadFixture, type Chunk, type FileMergeData } from "../../ipc";
import {
  actionSteps,
  bulkApplySteps,
  dispatchSteps,
  type ApplyTarget,
  type Steps,
  type VisibleLines,
} from "./apply";
import { chunkField, type ChunkSpan } from "./chunkField";
import { centerDecorations } from "./decorations";
import { gapArrows } from "./gap";
import { lineSpan } from "./lineSpan";
import { paneState, paneText } from "./pane";
import type { Side } from "./side";
import { summarize } from "./status";

const MAGIC_KEYS = "vueuse-use-magic-keys.ts";

type Act = (merge: ApplyTarget, chunk: Chunk) => Steps;

async function synthetic(
  texts: { base: string; local: string; remote: string; eol: FileMergeData["eol"] },
  chunks: readonly {
    kind: Chunk["kind"];
    base: [number, number];
    side: [number, number];
    remote?: [number, number];
  }[],
): Promise<FileMergeData> {
  const record = {
    path: "synthetic.ts",
    deleted: null,
    ...texts,
    chunks: chunks.map((chunk, id) => {
      const [remoteStart, remoteLen] = chunk.remote ?? chunk.side;
      return {
        id,
        kind: chunk.kind,
        base: { start: chunk.base[0], len: chunk.base[1] },
        local: { start: chunk.side[0], len: chunk.side[1] },
        remote: { start: remoteStart, len: remoteLen },
      };
    }),
    word_changes: chunks.map((_chunk, id) => ({
      chunk: id,
      local: { changed: [], removed_at: [] },
      remote: { changed: [], removed_at: [] },
    })),
  };
  return loadFixture("synthetic.ts", { "synthetic.json": record });
}

function open(data: FileMergeData, kind: "center" | "readOnlyCenter" = "center"): ApplyTarget {
  const field = chunkField(data.chunks);
  const pane = { eol: data.eol, language: null };
  return {
    state: paneState({
      ...pane,
      kind,
      doc: data.base,
      extensions: [field, centerDecorations(field)],
    }),
    field,
    sides: {
      local: paneState({ ...pane, kind: "side", doc: data.local, extensions: [] }).doc,
      remote: paneState({ ...pane, kind: "side", doc: data.remote, extensions: [] }).doc,
    },
  };
}

async function magicKeys(): Promise<ApplyTarget> {
  return open(await loadFixture(MAGIC_KEYS));
}

function spanAt(merge: ApplyTarget, id: number): ChunkSpan {
  const span = merge.state.field(merge.field)[id];
  if (span === undefined) {
    throw new Error(`no chunk ${id}`);
  }
  return span;
}

function chunkAt(merge: ApplyTarget, id: number): Chunk {
  return spanAt(merge, id).chunk;
}

function expectHeadInside(merge: ApplyTarget, id: number): void {
  const { from, to } = spanAt(merge, id);
  const head = merge.state.selection.main.head;
  if (from === to) {
    expect(head).toBe(from);
    return;
  }
  expect(head).toBeGreaterThanOrEqual(from);
  expect(head).toBeLessThan(to);
}

function run(merge: ApplyTarget, steps: Steps, time = Date.now()): ApplyTarget {
  if (steps.length === 0) {
    throw new Error("expected a transaction");
  }
  let state = merge.state;
  dispatchSteps((spec) => {
    const tr = state.update(spec, { annotations: Transaction.time.of(time) });
    expect(tr.scrollIntoView).toBe(false);
    state = tr.state;
  }, steps);
  return { ...merge, state };
}

function applyOne(target: ApplyTarget, chunk: Chunk, side: Side): Steps {
  return actionSteps(target, { kind: "apply", side, chunks: [chunk] });
}

function ignoreOne(target: ApplyTarget, chunk: Chunk, side: Side): Steps {
  return actionSteps(target, { kind: "ignore", side, chunks: [chunk] });
}

function allVisible(merge: ApplyTarget): VisibleLines {
  return { first: 1, last: merge.state.doc.lines };
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

function statuses(merge: ApplyTarget): string[] {
  return merge.state.field(merge.field).map(({ status }) => `${status.local} ${status.remote}`);
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

  const applied = run(start, applyOne(start, chunkAt(start, 0), "local"));

  expect(centerText(applied, 0)).toBe(sideText(applied, 0, "local"));
  expect(centerText(applied, 0)).not.toBe(centerText(start, 0));
  expect(statuses(applied)[0]).toBe("applied pending");
  expect(decoratedLines(start.state)).toContain(3);
  expect(decoratedLines(applied.state)).not.toContain(3);
  expect(arrowLines(start, "local")).toContain(3);
  expect(arrowLines(applied, "local")).not.toContain(3);
  expect(summarize(start.state.field(start.field))).toEqual({ changes: 8, conflicts: 1 });
  expect(summarize(applied.state.field(applied.field))).toEqual({ changes: 7, conflicts: 1 });
  expect(applyOne(applied, chunkAt(applied, 0), "local")).toEqual([]);
  expect(applyOne(start, chunkAt(start, 0), "remote")).toEqual([]);
});

test("apply remote inserts the right lines at an empty base range", async () => {
  const start = await magicKeys();

  const applied = run(start, applyOne(start, chunkAt(start, 3), "remote"));

  expect(centerText(applied, 3)).toBe(sideText(applied, 3, "remote"));
  expect(applied.state.doc.lines).toBe(start.state.doc.lines + 1);
  expect(statuses(applied)[3]).toBe("pending applied");
  expect(arrowLines(applied, "remote")).not.toContain(arrowLines(start, "remote")[0]);
});

test("a conflict applied from both sides holds local then remote text", async () => {
  const start = await magicKeys();
  const conflict = chunkAt(start, 8);

  const local = run(start, applyOne(start, conflict, "local"));
  const both = run(local, applyOne(local, conflict, "remote"));

  expect(statuses(local)[8]).toBe("applied pending");
  expect(summarize(local.state.field(local.field))).toEqual({ changes: 8, conflicts: 1 });
  expect(arrowLines(local, "local")).not.toContain(129);
  expect(arrowLines(local, "remote")).toContain(141);
  expect(decoratedLines(local.state)).toContain(129);
  expect(centerText(both, 8)).toBe(sideText(both, 8, "local") + sideText(both, 8, "remote"));
  expect(statuses(both)[8]).toBe("applied applied");
  expect(summarize(both.state.field(both.field))).toEqual({ changes: 8, conflicts: 0 });
  expect(arrowLines(both, "remote")).not.toContain(141);
  expect(decoratedLines(both.state)).not.toContain(129);
});

test("ignore keeps the text and resolves a change or a half-applied conflict", async () => {
  const start = await magicKeys();

  const done = run(start, ignoreOne(start, chunkAt(start, 1), "local"));
  const half = run(done, applyOne(done, chunkAt(done, 8), "remote"));
  const settled = run(half, ignoreOne(half, chunkAt(half, 8), "local"));

  expect(done.state.doc.toString()).toBe(start.state.doc.toString());
  expect(statuses(done)[1]).toBe("ignored pending");
  expect(decoratedLines(done.state)).not.toContain(22);
  expect(arrowLines(done, "local")).not.toContain(22);
  expect(centerText(settled, 8)).toBe(sideText(settled, 8, "remote"));
  expect(statuses(settled)[8]).toBe("ignored applied");
  expect(summarize(settled.state.field(settled.field))).toEqual({ changes: 7, conflicts: 0 });
  expect(ignoreOne(settled, chunkAt(settled, 8), "local")).toEqual([]);
});

test("applying after an edit inside the change replaces the current range", async () => {
  const start = await magicKeys();
  const line = start.state.doc.line(3);
  const typed = {
    ...start,
    state: start.state.update({ changes: { from: line.to, insert: "\n// mine" } }).state,
  };

  const applied = run(typed, applyOne(typed, chunkAt(typed, 0), "local"));

  expect(centerText(typed, 0)).toContain("// mine");
  expect(centerText(applied, 0)).toBe(sideText(applied, 0, "local"));
  expect(applied.state.doc.lines).toBe(start.state.doc.lines);
});

test("undo after apply restores text and status; redo re-applies", async () => {
  const start = await magicKeys();
  const applied = run(start, applyOne(start, chunkAt(start, 0), "local"));

  const undone = command(applied, undo);
  const redone = command(undone, redo);

  expect(undone.state.doc.toString()).toBe(start.state.doc.toString());
  expect(statuses(undone)[0]).toBe("pending pending");
  expect(decoratedLines(undone.state)).toContain(3);
  expect(redone.state.doc.toString()).toBe(applied.state.doc.toString());
  expect(statuses(redone)[0]).toBe("applied pending");
});

test("undo after ignore brings the change back; redo ignores it again", async () => {
  const start = await magicKeys();
  const done = run(start, ignoreOne(start, chunkAt(start, 1), "local"));

  const undone = command(done, undo);
  const redone = command(undone, redo);

  expect(statuses(undone)[1]).toBe("pending pending");
  expect(statuses(redone)[1]).toBe("ignored pending");
});

test("undo and redo after an arrow or × show that change, not the old cursor at line 1", async () => {
  const start = await magicKeys();
  const same = open(
    await synthetic({ base: "a\nb\nc\n", local: "a\nB\nc\n", remote: "a\nB\nc\n", eol: "Lf" }, [
      { kind: "BothSame", base: [1, 1], side: [1, 1] },
    ]),
  );
  const cases: readonly { merge: ApplyTarget; id: number; act: Act }[] = [
    { merge: start, id: 4, act: (target, chunk) => applyOne(target, chunk, "remote") },
    { merge: start, id: 6, act: (target, chunk) => applyOne(target, chunk, "remote") },
    { merge: start, id: 8, act: (target, chunk) => applyOne(target, chunk, "local") },
    { merge: start, id: 8, act: (target, chunk) => applyOne(target, chunk, "remote") },
    { merge: start, id: 7, act: (target, chunk) => ignoreOne(target, chunk, "local") },
    { merge: same, id: 0, act: (target, chunk) => applyOne(target, chunk, "local") },
    { merge: same, id: 0, act: (target, chunk) => applyOne(target, chunk, "remote") },
  ];

  for (const { merge, id, act } of cases) {
    const done = run(merge, act(merge, chunkAt(merge, id)));
    const undone = command(done, undo);
    const redone = command(undone, redo);

    expect(merge.state.selection.main.head).toBe(0);
    expectHeadInside(undone, id);
    expectHeadInside(redone, id);
    expect(undoDepth(done.state)).toBe(undoDepth(merge.state) + 1);
    expect(done.state.selection.main.head).toBe(spanAt(done, id).from);
  }
});

test("redo of an insert-only apply puts the cursor on the first inserted line", async () => {
  const start = await magicKeys();
  const inserted = spanAt(start, 4);
  const done = run(start, applyOne(start, inserted.chunk, "remote"));

  const redone = command(command(done, undo), redo);

  expect(inserted.from).toBe(inserted.to);
  expect(spanAt(redone, 4).from).toBeLessThan(spanAt(redone, 4).to);
  expect(redone.state.selection.main.head).toBe(spanAt(redone, 4).from);
  expect(undoDepth(redone.state)).toBe(undoDepth(done.state));
});

test("typing right after an arrow click is an undo step of its own", async () => {
  const start = await magicKeys();
  const time = Date.now();
  const done = run(start, applyOne(start, chunkAt(start, 0), "local"), time);
  const head = done.state.selection.main.head;

  const typed = {
    ...done,
    state: done.state.update({
      changes: { from: head, insert: "z" },
      selection: { anchor: head + 1 },
      userEvent: "input.type",
      annotations: Transaction.time.of(time),
    }).state,
  };

  expect(undoDepth(typed.state)).toBe(undoDepth(start.state) + 2);
  expect(command(typed, undo).state.doc.toString()).toBe(done.state.doc.toString());
});

test("bulk apply moves a cursor outside the visible lines to the first one; undo returns there", async () => {
  const start = await magicKeys();
  const visible = { first: 100, last: 130 };
  const firstVisible = start.state.doc.line(visible.first).from;
  function lineEnd(line: number): ApplyTarget {
    const anchor = start.state.doc.line(line).to;
    return { ...start, state: start.state.update({ selection: { anchor } }).state };
  }

  for (const outside of [start, lineEnd(visible.first - 1), lineEnd(visible.last + 1)]) {
    const done = run(outside, bulkApplySteps({ target: outside, side: "local", visible }));
    const undone = command(done, undo);

    expect(undone.state.selection.main.head).toBe(firstVisible);
    expect(command(undone, redo).state.selection.main.head).toBe(done.state.selection.main.head);
    expect(undoDepth(done.state)).toBe(undoDepth(outside.state) + 1);
  }
  for (const inside of [lineEnd(visible.first), lineEnd(120), lineEnd(visible.last)]) {
    const head = inside.state.selection.main.head;
    const done = run(inside, bulkApplySteps({ target: inside, side: "local", visible }));

    expect(command(done, undo).state.selection.main.head).toBe(head);
    expect(undoDepth(done.state)).toBe(undoDepth(inside.state) + 1);
  }
});

test("bulk apply from the left resolves every LocalOnly change; one undo restores all", async () => {
  const start = await magicKeys();

  const bulk = run(
    start,
    bulkApplySteps({ target: start, side: "local", visible: allVisible(start) }),
  );
  const undone = command(bulk, undo);

  expect(statuses(bulk)).toEqual([
    "applied pending",
    "applied pending",
    "applied pending",
    "pending pending",
    "pending pending",
    "applied pending",
    "pending pending",
    "applied pending",
    "pending pending",
  ]);
  for (const id of [0, 1, 2, 5, 7]) {
    expect(centerText(bulk, id)).toBe(sideText(bulk, id, "local"));
  }
  expect(summarize(bulk.state.field(bulk.field))).toEqual({ changes: 3, conflicts: 1 });
  expect(bulkApplySteps({ target: bulk, side: "local", visible: allVisible(bulk) })).toEqual([]);
  expect(undone.state.doc.toString()).toBe(start.state.doc.toString());
  expect(statuses(undone)).toEqual(statuses(start));
});

test("a BothSame change resolves from either arrow and from either bulk apply", async () => {
  const merge = open(
    await synthetic({ base: "a\nb\nc\n", local: "a\nB\nc\n", remote: "a\nB\nc\n", eol: "Lf" }, [
      { kind: "BothSame", base: [1, 1], side: [1, 1] },
    ]),
  );
  const same = chunkAt(merge, 0);

  const fromRight = run(merge, applyOne(merge, same, "remote"));
  const bulkLeft = run(
    merge,
    bulkApplySteps({ target: merge, side: "local", visible: allVisible(merge) }),
  );
  const bulkRight = run(
    merge,
    bulkApplySteps({ target: merge, side: "remote", visible: allVisible(merge) }),
  );

  expect(arrowLines(merge, "local")).toEqual([2]);
  expect(arrowLines(merge, "remote")).toEqual([2]);
  expect(fromRight.state.sliceDoc()).toBe("a\nB\nc\n");
  expect(arrowLines(fromRight, "local")).toEqual([]);
  expect(summarize(fromRight.state.field(fromRight.field))).toEqual({ changes: 0, conflicts: 0 });
  expect(statuses(bulkLeft)).toEqual(["applied applied"]);
  expect(statuses(bulkRight)).toEqual(["applied applied"]);
  expect(bulkRight.state.sliceDoc()).toBe("a\nB\nc\n");
});

test("bulk apply from the right inserts every RemoteOnly change in place", async () => {
  const start = await magicKeys();

  const bulk = run(
    start,
    bulkApplySteps({ target: start, side: "remote", visible: allVisible(start) }),
  );

  for (const id of [3, 4, 6]) {
    expect(statuses(bulk)[id]).toBe("pending applied");
    expect(centerText(bulk, id)).toBe(sideText(bulk, id, "remote"));
  }
  expect(summarize(bulk.state.field(bulk.field))).toEqual({ changes: 5, conflicts: 1 });
});

test("bulk apply over touching spans whose last deletes an unterminated final line equals clicking each", async () => {
  const start = open(
    await synthetic({ base: "a\nb\nc", local: "a\nB", remote: "a\nb\nc", eol: "Lf" }, [
      { kind: "LocalOnly", base: [1, 1], side: [1, 1], remote: [1, 1] },
      { kind: "LocalOnly", base: [2, 1], side: [2, 0], remote: [2, 1] },
    ]),
  );
  function spans(merge: ApplyTarget): [number, number][] {
    return merge.state.field(merge.field).map(({ from, to }) => [from, to]);
  }

  const bulk = run(
    start,
    bulkApplySteps({ target: start, side: "local", visible: allVisible(start) }),
  );
  const first = run(start, applyOne(start, chunkAt(start, 0), "local"));
  const clicked = run(first, applyOne(first, chunkAt(first, 1), "local"));
  const undone = command(bulk, undo);

  expect(spanAt(start, 0).to).toBe(spanAt(start, 1).from);
  expect(clicked.state.sliceDoc()).toBe("a\nB");
  expect(bulk.state.sliceDoc()).toBe("a\nB");
  expect(spans(bulk)).toEqual(spans(clicked));
  expect(statuses(bulk)).toEqual(statuses(clicked));
  expect(undoDepth(bulk.state)).toBe(undoDepth(start.state) + 1);
  expect(undone.state.sliceDoc()).toBe(start.state.sliceDoc());
  expect(statuses(undone)).toEqual(statuses(start));
  expect(spans(undone)).toEqual(spans(start));
});

test("deleting all of a change's lines in the middle pane ignores it", async () => {
  const start = await magicKeys();
  const line = start.state.doc.line(3);

  const deleted = {
    ...start,
    state: start.state.update({ changes: { from: line.from, to: line.to + 1 } }).state,
  };

  expect(statuses(deleted)[0]).toBe("ignored ignored");
  expect(summarize(deleted.state.field(deleted.field))).toEqual({ changes: 7, conflicts: 1 });
  expect(statuses(command(deleted, undo))[0]).toBe("pending pending");
});

test("resultText of a CRLF file keeps CRLF after an apply", async () => {
  const merge = open(
    await synthetic(
      { base: "a\r\nb\r\nc\r\n", local: "a\r\nB\r\nc\r\n", remote: "a\r\nb\r\nc\r\n", eol: "CrLf" },
      [{ kind: "LocalOnly", base: [1, 1], side: [1, 1] }],
    ),
  );

  const applied = run(merge, applyOne(merge, chunkAt(merge, 0), "local"));

  expect(paneText(applied.state)).toBe("a\r\nB\r\nc\r\n");
});

test("a conflict applied from both sides after its separator line is deleted pushes the next change", async () => {
  const merge = open(
    await synthetic(
      { base: "a\nc\nx\nd\nz\n", local: "a\nL\nx\nD\nz\n", remote: "a\nR\nx\nd\nz\n", eol: "Lf" },
      [
        { kind: "Conflict", base: [1, 1], side: [1, 1] },
        { kind: "LocalOnly", base: [3, 1], side: [3, 1] },
      ],
    ),
  );
  const separator = merge.state.doc.line(3);
  const joined = {
    ...merge,
    state: merge.state.update({ changes: { from: separator.from, to: separator.to + 1 } }).state,
  };

  const local = run(joined, applyOne(joined, chunkAt(joined, 0), "local"));
  const both = run(local, applyOne(local, chunkAt(local, 0), "remote"));
  const next = run(both, applyOne(both, chunkAt(both, 1), "local"));

  expect(centerText(both, 0)).toBe("L\nR\n");
  expect(centerText(both, 1)).toBe("d\n");
  expect(statuses(both)).toEqual(["applied applied", "pending pending"]);
  expect(paneText(next.state)).toBe("a\nL\nR\nD\nz\n");
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
      await synthetic({ base, local, remote: base, eol: "Lf" }, [{ kind: "LocalOnly", ...chunk }]),
    );
    const applied = run(merge, applyOne(merge, chunkAt(merge, 0), "local"));
    expect(applied.state.sliceDoc()).toBe(result);
  }
});

test("a read-only middle pane refuses Enter, Tab and undo; bulk apply still changes it", async () => {
  const merge = open(await loadFixture(MAGIC_KEYS), "readOnlyCenter");
  function refused(target: ApplyTarget, edit: StateCommand): boolean {
    let dispatched = false;
    const ran = edit({
      state: target.state,
      dispatch: () => {
        dispatched = true;
      },
    });
    return !ran && !dispatched;
  }

  const bulk = run(
    merge,
    bulkApplySteps({ target: merge, side: "local", visible: allVisible(merge) }),
  );

  expect(merge.state.readOnly).toBe(true);
  expect(refused(merge, insertNewlineAndIndent)).toBe(true);
  expect(refused(merge, indentMore)).toBe(true);
  expect(statuses(bulk)[0]).toBe("applied pending");
  expect(centerText(bulk, 0)).toBe(sideText(bulk, 0, "local"));
  expect(refused(bulk, undo)).toBe(true);
  expect(refused(open(await loadFixture(MAGIC_KEYS)), insertNewlineAndIndent)).toBe(false);
});
