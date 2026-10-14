import { indentMore, insertNewlineAndIndent, redo, undo, undoDepth } from "@codemirror/commands";
import { Transaction, type EditorState, type StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, type Chunk, type FileMergeData } from "../../ipc";
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
import { centerKind, paneState, paneText, type PaneSettings } from "./pane";
import { paneDocs } from "./paneDocs";
import type { Side } from "./side";
import { summarize } from "./status";

const MAGIC_KEYS = "vueuse-use-magic-keys.ts";
const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};

type Act = (merge: ApplyTarget, chunk: Chunk) => Steps;

const MARKERS = {
  kind: "Markers",
  open: "<<<<<<< ours",
  between: ["======="],
  close: ">>>>>>> theirs",
};

async function synthetic(
  texts: { middle: string; local: string; remote: string; eol: FileMergeData["eol"] },
  chunks: readonly {
    kind: Chunk["kind"];
    middle: [number, number];
    side: [number, number];
    remote?: [number, number];
  }[],
): Promise<FileMergeData> {
  const { middle: text, ...sides } = texts;
  const record = {
    path: "synthetic.ts",
    deleted: null,
    middle: { kind: "Stages", text },
    ...sides,
    disk_version: 0,
    chunks: chunks.map((chunk, id) => {
      const [remoteStart, remoteLen] = chunk.remote ?? chunk.side;
      const middle = { start: chunk.middle[0], len: chunk.middle[1] };
      return {
        chunk: {
          id,
          kind: chunk.kind,
          base: middle,
          local: { start: chunk.side[0], len: chunk.side[1] },
          remote: { start: remoteStart, len: remoteLen },
        },
        middle,
        words: {
          chunk: id,
          local: { changed: [], removed_at: [] },
          remote: { changed: [], removed_at: [] },
        },
        waiting: chunk.kind === "Conflict" ? MARKERS : { kind: "SideLines" },
      };
    }),
  };
  return loadFixture("synthetic.ts", { "synthetic.json": record });
}

function open(data: FileMergeData, readOnly = false): ApplyTarget {
  const field = chunkField(data.chunks);
  const pane = { eol: data.eol, language: null, settings: SETTINGS };
  const docs = paneDocs(data);
  return {
    state: paneState({
      ...pane,
      kind: centerKind(readOnly),
      doc: docs.center,
      extensions: [field, centerDecorations(field)],
    }),
    field,
    sides: { local: docs.left, remote: docs.right },
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
  return actionSteps(target, { kind: "apply", side, chunks: [chunk] }, "side");
}

function ignoreOne(target: ApplyTarget, chunk: Chunk, side: Side): Steps {
  return actionSteps(target, { kind: "ignore", side, chunks: [chunk] }, "side");
}

function modOne(
  target: ApplyTarget,
  { kind, chunk, side }: { kind: "apply" | "ignore"; chunk: Chunk; side: Side },
): Steps {
  return actionSteps(target, { kind, side, chunks: [chunk] }, "conflict");
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

test("apply remote inserts the right lines at an empty middle range", async () => {
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
    await synthetic({ middle: "a\nb\nc\n", local: "a\nB\nc\n", remote: "a\nB\nc\n", eol: "Lf" }, [
      { kind: "BothSame", middle: [1, 1], side: [1, 1] },
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
    await synthetic({ middle: "a\nb\nc\n", local: "a\nB\nc\n", remote: "a\nB\nc\n", eol: "Lf" }, [
      { kind: "BothSame", middle: [1, 1], side: [1, 1] },
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
    await synthetic({ middle: "a\nb\nc", local: "a\nB", remote: "a\nb\nc", eol: "Lf" }, [
      { kind: "LocalOnly", middle: [1, 1], side: [1, 1], remote: [1, 1] },
      { kind: "LocalOnly", middle: [2, 1], side: [2, 0], remote: [2, 1] },
    ]),
  );

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
  expect(spanPairs(bulk)).toEqual(spanPairs(clicked));
  expect(statuses(bulk)).toEqual(statuses(clicked));
  expect(undoDepth(bulk.state)).toBe(undoDepth(start.state) + 1);
  expect(undone.state.sliceDoc()).toBe(start.state.sliceDoc());
  expect(statuses(undone)).toEqual(statuses(start));
  expect(spanPairs(undone)).toEqual(spanPairs(start));
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
      {
        middle: "a\r\nb\r\nc\r\n",
        local: "a\r\nB\r\nc\r\n",
        remote: "a\r\nb\r\nc\r\n",
        eol: "CrLf",
      },
      [{ kind: "LocalOnly", middle: [1, 1], side: [1, 1] }],
    ),
  );

  const applied = run(merge, applyOne(merge, chunkAt(merge, 0), "local"));

  expect(paneText(applied.state)).toBe("a\r\nB\r\nc\r\n");
});

test("a conflict applied from both sides after its separator line is deleted pushes the next change", async () => {
  const merge = open(
    await synthetic(
      {
        middle: "a\nc\nx\nd\nz\n",
        local: "a\nL\nx\nD\nz\n",
        remote: "a\nR\nx\nd\nz\n",
        eol: "Lf",
      },
      [
        { kind: "Conflict", middle: [1, 1], side: [1, 1] },
        { kind: "LocalOnly", middle: [3, 1], side: [3, 1] },
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
    { middle: "a\nb", local: "a\nB", chunk: { middle: [1, 1], side: [1, 1] }, result: "a\nB" },
    { middle: "a\nb", local: "a", chunk: { middle: [1, 1], side: [1, 0] }, result: "a" },
    { middle: "a", local: "a\nb", chunk: { middle: [1, 0], side: [1, 1] }, result: "a\nb" },
  ] satisfies {
    middle: string;
    local: string;
    chunk: { middle: [number, number]; side: [number, number] };
    result: string;
  }[];

  for (const { middle, local, chunk, result } of cases) {
    const merge = open(
      await synthetic({ middle, local, remote: middle, eol: "Lf" }, [
        { kind: "LocalOnly", ...chunk },
      ]),
    );
    const applied = run(merge, applyOne(merge, chunkAt(merge, 0), "local"));
    expect(applied.state.sliceDoc()).toBe(result);
  }
});

test("a side applied where a line break at the change's edge was deleted lands on lines of its own", async () => {
  const change = open(
    await synthetic({ middle: "a\nb\nz\n", local: "a\nB\nz\n", remote: "a\nb\nz\n", eol: "Lf" }, [
      { kind: "LocalOnly", middle: [1, 1], side: [1, 1] },
    ]),
  );
  const conflict = open(
    await synthetic({ middle: "a\nb\nz\n", local: "a\nL\nz\n", remote: "a\nR\nz\n", eol: "Lf" }, [
      { kind: "Conflict", middle: [1, 1], side: [1, 1] },
    ]),
  );
  function joined(merge: ApplyTarget, from: number): ApplyTarget {
    return { ...merge, state: merge.state.update({ changes: { from, to: from + 1 } }).state };
  }
  const after = joined(change, 3);
  const before = joined(change, 1);
  const local = run(conflict, applyOne(conflict, chunkAt(conflict, 0), "local"));
  const localJoined = joined(local, 3);

  expect(paneText(run(after, applyOne(after, chunkAt(after, 0), "local")).state)).toBe("a\nB\nz\n");
  expect(paneText(run(before, applyOne(before, chunkAt(before, 0), "local")).state)).toBe(
    "a\nB\nz\n",
  );
  expect(paneText(localJoined.state)).toBe("a\nLz\n");
  expect(
    paneText(run(localJoined, applyOne(localJoined, chunkAt(localJoined, 0), "remote")).state),
  ).toBe("a\nL\nR\nz\n");
});

test("a read-only middle pane refuses Enter, Tab and undo; bulk apply still changes it", async () => {
  const merge = open(await loadFixture(MAGIC_KEYS), true);
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

const WORKED_OURS = [
  "title",
  "=======",
  "one",
  "TWO",
  "shared-a",
  "three-ours",
  "shared-b",
  "four",
  "five",
  "six",
  "seven",
  "eight-ours",
  "nine",
  "ten",
];
const WORKED_THEIRS = [
  "title",
  "=======",
  "ONE",
  "two",
  "shared-a",
  "three-theirs",
  "shared-b",
  "four",
  "five",
  "six",
  "seven",
  "eight-theirs",
  "nine",
  "ten",
];

type Seeded = {
  readonly middle: readonly string[];
  readonly base: [number, number];
  readonly at: [number, number];
  readonly side: [number, number];
  readonly eol: FileMergeData["eol"];
};

function lines(texts: readonly string[], eol: FileMergeData["eol"]): string {
  const separator = eol === "CrLf" ? "\r\n" : "\n";
  return texts.map((text) => `${text}${separator}`).join("");
}

function range([start, len]: [number, number]): { start: number; len: number } {
  return { start, len };
}

async function diskSeeded({ middle, base, at, side, eol }: Seeded): Promise<FileMergeData> {
  const record = {
    path: "worked.txt",
    deleted: null,
    middle: { kind: "Disk", text: lines(middle, eol) },
    local: lines(WORKED_OURS, eol),
    remote: lines(WORKED_THEIRS, eol),
    eol,
    disk_version: 1,
    chunks: [
      {
        chunk: {
          id: 0,
          kind: "Conflict",
          base: range(base),
          local: range(side),
          remote: range(side),
        },
        middle: range(at),
        words: {
          chunk: 0,
          local: { changed: [], removed_at: [] },
          remote: { changed: [], removed_at: [] },
        },
        waiting: MARKERS,
      },
    ],
  };
  return loadFixture("worked.txt", { "worked.json": record });
}

const ONE_BLOCK_LEFT = [
  "title",
  "=======",
  "one",
  "two",
  "three",
  "shared-b",
  "four",
  "five",
  "six",
  "seven",
  "eight-theirs",
  "nine",
  "ten",
];

test.each<FileMergeData["eol"]>(["Lf", "CrLf"])(
  "a disk-seeded block takes ours exactly as the hand resolution, and undo brings the disk text back (%s)",
  async (eol) => {
    const merge = open(
      await diskSeeded({ middle: ONE_BLOCK_LEFT, base: [2, 3], at: [2, 3], side: [2, 4], eol }),
    );

    const applied = run(merge, applyOne(merge, chunkAt(merge, 0), "local"));
    const undone = command(applied, undo);

    expect(paneText(merge.state)).toBe(lines(ONE_BLOCK_LEFT, eol));
    expect(paneText(applied.state)).toBe(
      lines([...WORKED_OURS.slice(0, -3), "eight-theirs", "nine", "ten"], eol),
    );
    expect(statuses(applied)).toEqual(["applied pending"]);
    expect(paneText(undone.state)).toBe(lines(ONE_BLOCK_LEFT, eol));
    expect(centerText(undone, 0)).toBe(lines(["one", "two", "three"], eol));
  },
);

test("a chunk spans its middle range, not where its base range would put it", async () => {
  const middle = [...WORKED_OURS.slice(0, -3), "eight", "nine", "ten"];
  const merge = open(
    await diskSeeded({ middle, base: [9, 1], at: [11, 1], side: [11, 1], eol: "Lf" }),
  );

  expect(centerText(merge, 0)).toBe("eight\n");

  const applied = run(merge, applyOne(merge, chunkAt(merge, 0), "remote"));

  expect(paneText(applied.state)).toBe(
    lines([...middle.slice(0, -3), "eight-theirs", "nine", "ten"], "Lf"),
  );
});

test("a middle that is not text on disk is an empty document", async () => {
  const data = await diskSeeded({ middle: [], base: [0, 0], at: [0, 0], side: [0, 0], eol: "Lf" });
  const notText: FileMergeData = {
    ...data,
    middle: { kind: "DiskNotText", found: "Binary" },
    chunks: [],
  };

  expect(paneDocs(notText).center.length).toBe(0);
  expect(open(notText, true).state.sliceDoc()).toBe("");
  expect(open(notText, true).state.readOnly).toBe(true);
  expect(centerKind(false)).toBe("center");
  expect(centerKind(true)).toBe("readOnlyCenter");
});

const SHARED = Array.from({ length: 19 }, (_, line) => `shared-${line}`);

function addedConflict(
  id: number,
  ranges: { middle: [number, number]; local: [number, number]; remote: [number, number] },
): unknown {
  return {
    chunk: {
      id,
      kind: "Conflict",
      base: { start: 0, len: 0 },
      local: range(ranges.local),
      remote: range(ranges.remote),
    },
    middle: range(ranges.middle),
    words: {
      chunk: id,
      local: { changed: [], removed_at: [] },
      remote: { changed: [], removed_at: [] },
    },
    waiting: MARKERS,
  };
}

test("an add/add file reopened from the disk: a one-sided apply stays a conflict until the other side is settled", async () => {
  const record = {
    path: "added.ts",
    deleted: null,
    middle: { kind: "Disk", text: lines([...SHARED, "}"], "Lf") },
    local: lines(["L0", "L1", ...SHARED, "L2", "L3", "L4", "L5", "}"], "Lf"),
    remote: lines(["R0", "R1", "R2", "R3", "R4", ...SHARED, "R5", "R6", "R7", "}"], "Lf"),
    eol: "Lf",
    disk_version: 1,
    chunks: [
      addedConflict(0, { middle: [0, 0], local: [0, 2], remote: [0, 5] }),
      addedConflict(1, { middle: [19, 0], local: [21, 4], remote: [24, 3] }),
    ],
  };
  const merge = open(await loadFixture("added.ts", { "added.json": record }));

  const local = run(merge, applyOne(merge, chunkAt(merge, 0), "local"));
  const ignored = run(local, ignoreOne(local, chunkAt(local, 0), "remote"));
  const lower = run(ignored, applyOne(ignored, chunkAt(ignored, 1), "local"));
  const both = run(lower, applyOne(lower, chunkAt(lower, 1), "remote"));

  expect(paneText(local.state)).toBe(lines(["L0", "L1", ...SHARED, "}"], "Lf"));
  expect(statuses(local)).toEqual(["applied pending", "pending pending"]);
  expect(summarize(local.state.field(local.field))).toEqual({ changes: 0, conflicts: 2 });
  expect(summarize(ignored.state.field(ignored.field))).toEqual({ changes: 0, conflicts: 1 });
  expect(paneText(both.state)).toBe(
    lines(["L0", "L1", ...SHARED, "L2", "L3", "L4", "L5", "R5", "R6", "R7", "}"], "Lf"),
  );
  expect(summarize(both.state.field(both.field))).toEqual({ changes: 0, conflicts: 0 });
});

test("Ctrl/Cmd apply on a waiting conflict takes that side and ignores the other, as one undo step", async () => {
  const start = await magicKeys();
  const conflict = chunkAt(start, 8);

  const both = run(start, modOne(start, { kind: "apply", chunk: conflict, side: "local" }));
  const local = run(start, applyOne(start, conflict, "local"));
  const plain = run(local, ignoreOne(local, conflict, "remote"));
  const undone = command(both, undo);

  expect(statuses(both)[8]).toBe("applied ignored");
  expect(centerText(both, 8)).toBe(sideText(both, 8, "local"));
  expect(paneText(both.state)).toBe(paneText(plain.state));
  expect(statuses(both)).toEqual(statuses(plain));
  expect(summarize(both.state.field(both.field))).toEqual({ changes: 8, conflicts: 0 });
  expect(undoDepth(both.state)).toBe(undoDepth(start.state) + 1);
  expect(paneText(undone.state)).toBe(paneText(start.state));
  expect(statuses(undone)).toEqual(statuses(start));
});

test("Ctrl/Cmd ignore on a waiting conflict ignores that side and takes the other, as one undo step", async () => {
  const start = await magicKeys();
  const conflict = chunkAt(start, 8);

  const both = run(start, modOne(start, { kind: "ignore", chunk: conflict, side: "local" }));
  const ignored = run(start, ignoreOne(start, conflict, "local"));
  const plain = run(ignored, applyOne(ignored, conflict, "remote"));
  const undone = command(both, undo);

  expect(statuses(both)[8]).toBe("ignored applied");
  expect(centerText(both, 8)).toBe(sideText(both, 8, "remote"));
  expect(paneText(both.state)).toBe(paneText(plain.state));
  expect(statuses(both)).toEqual(statuses(plain));
  expect(undoDepth(both.state)).toBe(undoDepth(start.state) + 1);
  expect(paneText(undone.state)).toBe(paneText(start.state));
  expect(statuses(undone)).toEqual(statuses(start));
});

test("Ctrl/Cmd apply on a conflict whose other side was applied appends, and both sides read applied", async () => {
  const start = await magicKeys();
  const conflict = chunkAt(start, 8);
  const remoteApplied = run(start, applyOne(start, conflict, "remote"));

  const appended = run(
    remoteApplied,
    modOne(remoteApplied, { kind: "apply", chunk: conflict, side: "local" }),
  );
  const plain = run(remoteApplied, applyOne(remoteApplied, conflict, "local"));

  expect(statuses(appended)[8]).toBe("applied applied");
  expect(centerText(appended, 8)).toBe(
    sideText(appended, 8, "remote") + sideText(appended, 8, "local"),
  );
  expect(paneText(appended.state)).toBe(paneText(plain.state));
});

test("Ctrl/Cmd ignore on a conflict whose other side was ignored leaves the middle as it is", async () => {
  const start = await magicKeys();
  const conflict = chunkAt(start, 8);
  const remoteIgnored = run(start, ignoreOne(start, conflict, "remote"));

  const kept = run(
    remoteIgnored,
    modOne(remoteIgnored, { kind: "ignore", chunk: conflict, side: "local" }),
  );

  expect(paneText(kept.state)).toBe(paneText(start.state));
  expect(statuses(kept)[8]).toBe("ignored ignored");
});

test("Ctrl/Cmd on a change that is not a conflict gives the plain click's outcome", async () => {
  const start = await magicKeys();
  const cases = [
    { kind: "apply", id: 0, side: "local" },
    { kind: "ignore", id: 1, side: "local" },
    { kind: "apply", id: 3, side: "remote" },
  ] satisfies { kind: "apply" | "ignore"; id: number; side: Side }[];

  for (const { kind, id, side } of cases) {
    const chunk = chunkAt(start, id);
    const withMod = run(start, modOne(start, { kind, chunk, side }));
    const plain = run(start, actionSteps(start, { kind, side, chunks: [chunk] }, "side"));

    expect(paneText(withMod.state)).toBe(paneText(plain.state));
    expect(statuses(withMod)).toEqual(statuses(plain));
  }
});

async function conflictLocalConflict(): Promise<ApplyTarget> {
  return open(
    await synthetic(
      {
        middle: "a\nb\nc\nd\ne\nf\ng\n",
        local: "a\nL1\nc\nL3\ne\nL5\ng\n",
        remote: "a\nR1\nc\nd\ne\nR5\ng\n",
        eol: "Lf",
      },
      [
        { kind: "Conflict", middle: [1, 1], side: [1, 1] },
        { kind: "LocalOnly", middle: [3, 1], side: [3, 1] },
        { kind: "Conflict", middle: [5, 1], side: [5, 1] },
      ],
    ),
  );
}

test("a drag released with Ctrl/Cmd decides each covered conflict whole and each other change plainly, as one undo step", async () => {
  const start = await conflictLocalConflict();
  const chunks = [0, 1, 2].map((id) => chunkAt(start, id));

  const applied = run(
    start,
    actionSteps(start, { kind: "apply", side: "local", chunks }, "conflict"),
  );
  const ignored = run(
    start,
    actionSteps(start, { kind: "ignore", side: "local", chunks }, "conflict"),
  );
  const undone = command(applied, undo);

  expect(paneText(applied.state)).toBe("a\nL1\nc\nL3\ne\nL5\ng\n");
  expect(statuses(applied)).toEqual(["applied ignored", "applied pending", "applied ignored"]);
  expect(paneText(ignored.state)).toBe("a\nR1\nc\nd\ne\nR5\ng\n");
  expect(statuses(ignored)).toEqual(["ignored applied", "ignored pending", "ignored applied"]);
  expect(undoDepth(applied.state)).toBe(undoDepth(start.state) + 1);
  expect(undoDepth(ignored.state)).toBe(undoDepth(start.state) + 1);
  expect(paneText(undone.state)).toBe(paneText(start.state));
  expect(statuses(undone)).toEqual(statuses(start));
});

test("Ctrl/Cmd ignore on a conflict whose other side has no lines removes the block and resolves it", async () => {
  const start = open(
    await synthetic({ middle: "a\nb\nc\n", local: "a\nL\nc\n", remote: "a\nc\n", eol: "Lf" }, [
      { kind: "Conflict", middle: [1, 1], side: [1, 1], remote: [1, 0] },
    ]),
  );

  const done = run(
    start,
    modOne(start, { kind: "ignore", chunk: chunkAt(start, 0), side: "local" }),
  );

  expect(paneText(done.state)).toBe("a\nc\n");
  expect(statuses(done)).toEqual(["ignored applied"]);
  expect(summarize(done.state.field(done.field))).toEqual({ changes: 0, conflicts: 0 });
});

test("a Ctrl/Cmd drag over an ignored change touching a conflict it fills equals clicking each", async () => {
  const start = open(
    await synthetic(
      { middle: "a\nb\nc\n", local: "a\nB\nL\nc\n", remote: "a\nb\nR\nc\n", eol: "Lf" },
      [
        { kind: "LocalOnly", middle: [1, 1], side: [1, 1] },
        { kind: "Conflict", middle: [2, 0], side: [2, 1] },
      ],
    ),
  );
  const chunks = [chunkAt(start, 0), chunkAt(start, 1)];

  const dragged = run(
    start,
    actionSteps(start, { kind: "ignore", side: "local", chunks }, "conflict"),
  );
  const first = run(start, ignoreOne(start, chunkAt(start, 0), "local"));
  const clicked = run(
    first,
    modOne(first, { kind: "ignore", chunk: chunkAt(first, 1), side: "local" }),
  );

  expect(spanAt(start, 0).to).toBe(spanAt(start, 1).from);
  expect(paneText(dragged.state)).toBe("a\nb\nR\nc\n");
  expect(spanPairs(dragged)).toEqual(spanPairs(clicked));
  expect(statuses(dragged)).toEqual(["ignored pending", "ignored applied"]);
});

function spanPairs(merge: ApplyTarget): [number, number][] {
  return merge.state.field(merge.field).map(({ from, to }) => [from, to]);
}

test("a Ctrl/Cmd ignore dragged over a conflict and a touching zero-line conflict equals clicking each", async () => {
  const start = open(
    await synthetic(
      {
        middle: "a\nb\nc\n",
        local: "a\nL1\nL2\nc\n",
        remote: "a\nR1\nR2\nc\n",
        eol: "Lf",
      },
      [
        { kind: "Conflict", middle: [1, 1], side: [1, 1] },
        { kind: "Conflict", middle: [2, 0], side: [2, 1] },
      ],
    ),
  );
  const chunks = [chunkAt(start, 0), chunkAt(start, 1)];

  const dragged = run(
    start,
    actionSteps(start, { kind: "ignore", side: "local", chunks }, "conflict"),
  );
  const first = run(
    start,
    modOne(start, { kind: "ignore", chunk: chunkAt(start, 0), side: "local" }),
  );
  const clicked = run(
    first,
    modOne(first, { kind: "ignore", chunk: chunkAt(first, 1), side: "local" }),
  );

  expect(spanAt(start, 0).to).toBe(spanAt(start, 1).from);
  expect(paneText(clicked.state)).toBe("a\nR1\nR2\nc\n");
  expect(paneText(dragged.state)).toBe(paneText(clicked.state));
  expect(spanPairs(clicked)).toEqual([
    [2, 5],
    [5, 8],
  ]);
  expect(spanPairs(dragged)).toEqual(spanPairs(clicked));
  expect(statuses(dragged)).toEqual(statuses(clicked));
});

test("an apply drag over a change and a touching zero-line conflict equals clicking each", async () => {
  const start = open(
    await synthetic(
      { middle: "a\nb\nc\n", local: "a\nB\nL\nc\n", remote: "a\nb\nR\nc\n", eol: "Lf" },
      [
        { kind: "LocalOnly", middle: [1, 1], side: [1, 1] },
        { kind: "Conflict", middle: [2, 0], side: [2, 1] },
      ],
    ),
  );
  const chunks = [chunkAt(start, 0), chunkAt(start, 1)];

  const dragged = run(start, actionSteps(start, { kind: "apply", side: "local", chunks }, "side"));
  const first = run(start, applyOne(start, chunkAt(start, 0), "local"));
  const clicked = run(first, applyOne(first, chunkAt(first, 1), "local"));

  expect(spanAt(start, 0).to).toBe(spanAt(start, 1).from);
  expect(paneText(clicked.state)).toBe("a\nB\nL\nc\n");
  expect(paneText(dragged.state)).toBe(paneText(clicked.state));
  expect(spanPairs(clicked)).toEqual([
    [2, 4],
    [4, 6],
  ]);
  expect(spanPairs(dragged)).toEqual(spanPairs(clicked));
  expect(statuses(dragged)).toEqual(statuses(clicked));
});
