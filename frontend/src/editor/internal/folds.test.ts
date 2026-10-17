import { undo, undoDepth, undoSelection } from "@codemirror/commands";
import {
  EditorSelection,
  type EditorState,
  type StateField,
  type TransactionSpec,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, type FileMergeData } from "../../ipc";
import { actionSteps, bulkApplySteps, dispatchSteps, type ApplyTarget } from "./apply";
import { chunkField } from "./chunkField";
import { selectMatch } from "./findMatch";
import { displayed, foldRuns, type Fold, type Hidden } from "./foldRuns";
import {
  collapseSpec,
  foldFields,
  paneFolds,
  showFolds,
  showNextStep,
  sideFoldPush,
  sideReveal,
  waveStarts,
  type FoldFields,
  type FoldState,
} from "./folds";
import { revealKeep } from "./foldSelection";
import { centerFolds, sideFolds } from "./foldView";
import type { Pane } from "./geometry";
import { revealSteps } from "./markJump";
import { paneState, type PaneSettings } from "./pane";
import { paneDocs } from "./paneDocs";

const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};

type Merge = ApplyTarget & {
  readonly fields: FoldFields;
  readonly folds: StateField<FoldState>;
  readonly runs: Fold[];
};

function noViews(): never {
  throw new Error("a state test has no views");
}

function numbered(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `line ${from + index}`);
}

function noWords(id: number) {
  return {
    chunk: id,
    local: { changed: [], removals: [] },
    remote: { changed: [], removals: [] },
  };
}

async function twoChanges(): Promise<FileMergeData> {
  const middle = numbered(1, 100);
  const local = [...numbered(1, 30), "local a", "local b", "local c", ...numbered(33, 100)];
  const remote = [...numbered(1, 70), "remote x", ...numbered(72, 100)];
  const record = {
    path: "synthetic.ts",
    deleted: null,
    middle: { kind: "Stages", text: `${middle.join("\n")}\n` },
    local: `${local.join("\n")}\n`,
    remote: `${remote.join("\n")}\n`,
    eol: "Lf",
    disk_version: 0,
    chunks: [
      {
        chunk: {
          id: 0,
          kind: "LocalOnly",
          base: { start: 30, len: 2 },
          local: { start: 30, len: 3 },
          remote: { start: 30, len: 2 },
        },
        middle: { start: 30, len: 2 },
        words: noWords(0),
        waiting: { kind: "SideLines" },
      },
      {
        chunk: {
          id: 1,
          kind: "RemoteOnly",
          base: { start: 70, len: 1 },
          local: { start: 71, len: 1 },
          remote: { start: 70, len: 1 },
        },
        middle: { start: 70, len: 1 },
        words: noWords(1),
        waiting: { kind: "SideLines" },
      },
    ],
  };
  return loadFixture("synthetic.ts", { "synthetic.json": record });
}

async function open(collapsed = true): Promise<Merge> {
  const data = await twoChanges();
  const docs = paneDocs(data);
  const runs = foldRuns(data.chunks, docs);
  const field = chunkField(data.chunks);
  const fields = foldFields(runs, collapsed);
  const state = paneState({
    kind: "center",
    doc: docs.center,
    eol: data.eol,
    language: null,
    settings: SETTINGS,
    extensions: [field, centerFolds({ folds: fields, hovered: () => null, views: noViews })],
  });
  const sides = { local: docs.left, remote: docs.right };
  return { state, field, fields, folds: fields.center, runs, sides };
}

function sidePane(merge: Merge, pane: "left" | "right"): EditorState {
  return paneState({
    kind: "side",
    doc: pane === "left" ? merge.sides.local : merge.sides.remote,
    eol: "Lf",
    language: null,
    settings: SETTINGS,
    extensions: sideFolds({ folds: merge.fields, hovered: () => null, views: noViews }, pane),
  });
}

function after(merge: Merge, ...specs: TransactionSpec[]): Merge {
  return { ...merge, state: merge.state.update(...specs).state };
}

function steps(merge: Merge, list: readonly TransactionSpec[]): Merge {
  let state = merge.state;
  dispatchSteps((spec) => {
    state = state.update(spec).state;
  }, list);
  return { ...merge, state };
}

function lineRange(state: EditorState, hidden: Hidden | null): string {
  return hidden === null
    ? "-"
    : `${state.doc.lineAt(hidden.from).number}-${state.doc.lineAt(hidden.to).number}`;
}

function middleFolds(merge: Merge): readonly Fold[] {
  return paneFolds(merge.fields, "center", merge.state);
}

function centerLines(merge: Merge, run: number): string[] {
  const fold = middleFolds(merge)[run];
  return fold === undefined ? [] : fold.hidden.map((level) => lineRange(merge.state, level.center));
}

function hiddenTexts(merge: Merge): string[] {
  return middleFolds(merge).flatMap((fold) =>
    fold.hidden.map(({ center }) =>
      center === null ? "-" : merge.state.sliceDoc(center.from, center.to),
    ),
  );
}

function levelOf(merge: Merge, run: number, level: number): Hidden {
  const hidden = middleFolds(merge)[run]?.hidden[level]?.center;
  if (hidden === undefined || hidden === null) {
    throw new Error(`run ${run} has no level ${level} in the middle`);
  }
  return hidden;
}

function click(merge: Merge, run: number): Merge {
  return after(merge, showNextStep(merge.state.field(merge.folds), run));
}

function collapsing(merge: Merge, on: boolean): Merge {
  return after(merge, collapseSpec(merge.folds, merge.state, on));
}

test("the middle starts with every run's levels: 4, 8 and 16 lines kept next to each change", async () => {
  const merge = await open();

  expect([0, 1, 2].map((run) => centerLines(merge, run))).toEqual([
    ["1-26", "1-22", "1-14"],
    ["37-66", "41-62", "49-54"],
    ["76-101", "80-101", "88-101"],
  ]);
});

test("a line inserted above moves every range below it by one line", async () => {
  const merge = after(await open(), { changes: { from: 0, insert: "new\n" } });

  expect(centerLines(merge, 1)).toEqual(["38-67", "42-63", "50-55"]);
  expect(centerLines(merge, 0)).toEqual(["2-27", "2-23", "2-15"]);
});

test("typing at a hidden range's first or last character shows that line only", async () => {
  const merge = await open();
  const { from, to } = levelOf(merge, 1, 0);

  expect(centerLines(after(merge, { changes: { from, insert: "x" } }), 1)[0]).toBe("38-66");
  expect(centerLines(after(merge, { changes: { from: to, insert: "x" } }), 1)[0]).toBe("37-65");
});

test("deleting a level down to one line shows it, and undo does not hide it again", async () => {
  const merge = await open();
  const doc = merge.state.doc;
  const deleted = after(merge, {
    changes: { from: doc.line(50).from, to: doc.line(55).from },
  });
  const undone = { ...deleted, state: undoneState(deleted.state) };

  expect(centerLines(deleted, 1)).toEqual(["37-61", "41-57", "-"]);
  expect(centerLines(undone, 1)).toEqual(["37-66", "41-62", "-"]);
});

function undoneState(state: EditorState): EditorState {
  let next = state;
  undo({
    state,
    dispatch: (tr) => {
      next = tr.state;
    },
  });
  return next;
}

test("deciding a change and bulk apply keep every hidden range's lines and every count", async () => {
  const merge = await open();
  const before = hiddenTexts(merge);
  const [first, second] = merge.state.field(merge.field);
  if (first === undefined || second === undefined) {
    throw new Error("the data lost its chunks");
  }
  const applied = steps(
    merge,
    actionSteps(merge, { kind: "apply", side: "local", chunks: [first.chunk] }, "side"),
  );
  const bulk = steps(
    merge,
    bulkApplySteps({ target: merge, side: "remote", visible: { first: 1, last: 10 } }),
  );

  expect(hiddenTexts(applied)).toEqual(before);
  expect(hiddenTexts(bulk)).toEqual(before);
  expect(centerLines(applied, 1)).toEqual(["38-67", "42-63", "50-55"]);
  expect(applied.state.field(merge.folds).hiding).toEqual([3, 3, 3]);
});

test("each click shows the outermost hidden level; three clicks empty the run", async () => {
  const once = click(await open(), 1);
  const twice = click(once, 1);
  const thrice = click(twice, 1);

  expect(centerLines(once, 1)).toEqual(["41-62", "49-54"]);
  expect(centerLines(twice, 1)).toEqual(["49-54"]);
  expect(centerLines(thrice, 1)).toEqual([]);
  expect(centerLines(click(thrice, 1), 1)).toEqual([]);
  expect(centerLines(thrice, 0)).toEqual(["1-26", "1-22", "1-14"]);
});

test("a step that keeps more levels than are hidden hides nothing again", async () => {
  const once = click(await open(), 1);
  const asked = after(once, { effects: showFolds.of({ run: 1, keep: 3 }) });

  expect(asked.state.field(asked.folds)).toBe(once.state.field(once.folds));
});

test("a click is not an undo step", async () => {
  const merge = click(await open(), 1);
  let undid = false;

  expect(
    undo({
      state: merge.state,
      dispatch: () => {
        undid = true;
      },
    }),
  ).toBe(false);
  expect(undid).toBe(false);
});

test("a find match shows every level holding it, through the innermost one", async () => {
  const merge = await open();
  const doc = merge.state.doc;
  const deep = doc.line(50);
  const shallow = doc.line(39);

  expect(centerLines(after(merge, selectMatch({ from: deep.from + 1, to: deep.to })), 1)).toEqual(
    [],
  );
  expect(centerLines(after(merge, selectMatch({ from: shallow.from, to: shallow.to })), 1)).toEqual(
    ["41-62", "49-54"],
  );
});

test("a match ending exactly at a range's end shows it", async () => {
  const merge = await open();
  const { to } = levelOf(merge, 1, 0);

  expect(centerLines(after(merge, selectMatch({ from: to - 2, to })), 1)).toEqual([
    "41-62",
    "49-54",
  ]);
});

test("a cursor at a range's first or last position shows nothing", async () => {
  const merge = await open();
  const { from, to } = levelOf(merge, 1, 0);

  for (const pos of [from, to]) {
    const moved = after(merge, { selection: EditorSelection.cursor(pos) });
    expect(moved.state.field(moved.folds)).toBe(merge.state.field(merge.folds));
  }
});

test("a selection with both ends exactly on a range's edges shows it", async () => {
  const merge = await open();
  const { from, to } = levelOf(merge, 1, 0);

  expect(centerLines(after(merge, selectMatch({ from, to })), 1)).toEqual(["41-62", "49-54"]);
});

function jumpAt(merge: Merge, pos: number): Merge {
  return revealSteps(merge.state, merge.fields, pos).reduce(
    (done, step) => after(done, step),
    merge,
  );
}

test("a problem tick's jump to a zero-length problem at a hidden range's first or last position shows it with the cursor there", async () => {
  const merge = await open();
  const { from, to } = levelOf(merge, 1, 0);

  for (const pos of [from, to]) {
    const jumped = jumpAt(merge, pos);
    expect(centerLines(jumped, 1), `${pos}`).toEqual(["41-62", "49-54"]);
    expect(jumped.state.selection.main).toEqual(EditorSelection.cursor(pos));
  }
});

test("a problem tick's jump to the end of a file ending with a line break shows the collapsed tail", async () => {
  const merge = await open();
  const end = merge.state.doc.length;

  expect(merge.state.doc.lineAt(end).length).toBe(0);
  expect(levelOf(merge, 2, 0).to).toBe(end);
  const jumped = jumpAt(merge, end);
  expect(centerLines(jumped, 2)).toEqual([]);
  expect(jumped.state.selection.main).toEqual(EditorSelection.cursor(end));
});

test("a problem tick's jump to an empty first hidden line shows the range holding it", async () => {
  const opened = await open();
  const first = opened.state.doc.lineAt(levelOf(opened, 1, 0).from);
  const merge = after(opened, { changes: { from: first.from, to: first.to } });
  const { from } = levelOf(merge, 1, 0);

  expect(merge.state.doc.lineAt(from).length).toBe(0);
  const jumped = jumpAt(merge, from);
  expect(centerLines(jumped, 1)).toEqual(["41-62", "49-54"]);
  expect(jumped.state.selection.main).toEqual(EditorSelection.cursor(from));
});

test("a side's reveal reads its own ranges and shows what the middle shows for the same line", async () => {
  const merge = await open();
  const leftDoc = merge.sides.local;
  const centerDoc = merge.state.doc;
  const leftAt = EditorSelection.cursor(leftDoc.line(101).from + 2);
  const centerAt = EditorSelection.cursor(centerDoc.line(100).from + 2);
  const centerRanges = merge.runs[2]?.hidden.map((level) => level.center) ?? [];
  const selected = sidePane(merge, "left").update({ selection: leftAt }).state;
  const spec = sideReveal(merge.fields, "left", selected);
  const fromSide = spec === null ? merge : after(merge, spec);
  const fromMiddle = after(merge, { selection: centerAt });

  expect(leftDoc.lineAt(leftAt.head).text).toBe(centerDoc.lineAt(centerAt.head).text);
  expect(revealKeep(centerRanges, leftAt)).toBeNull();
  expect(centerLines(fromMiddle, 2)).toEqual([]);
  expect(fromSide.state.field(merge.folds)).toEqual(fromMiddle.state.field(merge.folds));
});

function pushed(merge: Merge, pane: "left" | "right", side: EditorState): EditorState {
  const spec = sideFoldPush(merge.fields, pane, side, merge.state.field(merge.folds));
  return spec === null ? side : side.update(spec).state;
}

test("the sides are told the counts only when they differ, and mirror them", async () => {
  const merge = await open();
  const sides = merge.fields.sides;
  const side = sidePane(merge, "left");
  const clicked = click(merge, 1);
  const mirrored = pushed(clicked, "left", side);
  const clickedFolds = clicked.state.field(merge.folds);

  expect(sideFoldPush(merge.fields, "left", side, merge.state.field(merge.folds))).toBeNull();
  expect(mirrored.field(sides)).toEqual([3, 2, 3]);
  expect(paneFolds(merge.fields, "left", mirrored)[1]?.hidden).toEqual(
    merge.runs[1]?.hidden.slice(1),
  );
  expect(sideFoldPush(merge.fields, "left", mirrored, clickedFolds)).toBeNull();
});

test("a side cursor inside lines that get hidden moves to the wave line's start when counts grow, not when they shrink", async () => {
  const merge = await open();
  const sides = merge.fields.sides;
  const outer = merge.runs[1]?.hidden[0]?.left;
  const inner = merge.runs[1]?.hidden[2]?.left;
  if (outer === undefined || outer === null || inner === undefined || inner === null) {
    throw new Error("run 1 lost its left levels");
  }
  const insideInner = EditorSelection.cursor(inner.from + 2);
  const shownSide = pushed(collapsing(merge, false), "left", sidePane(merge, "left")).update({
    selection: insideInner,
  }).state;
  const grown = pushed(merge, "left", shownSide);
  const hiddenSide = sidePane(merge, "left").update({ selection: insideInner }).state;
  const shrunk = pushed(click(merge, 1), "left", hiddenSide);

  expect(shownSide.field(sides)).toEqual([0, 0, 0]);
  expect(grown.field(sides)).toEqual([3, 3, 3]);
  expect(grown.selection.main.head).toBe(outer.from);
  expect(shrunk.field(sides)).toEqual([3, 2, 3]);
  expect(shrunk.selection.main.head).toBe(insideInner.head);
});

function drawnStarts(state: EditorState): number[] {
  const found: number[] = [];
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source !== "function") {
      source.between(0, state.doc.length, (from) => {
        found.push(from);
      });
    }
  }
  return found;
}

test("each pane's wave starts are where that pane draws its waves", async () => {
  const merge = click(click(await open(), 1), 0);
  const states: Readonly<Record<Pane, EditorState>> = {
    left: pushed(merge, "left", sidePane(merge, "left")),
    center: merge.state,
    right: pushed(merge, "right", sidePane(merge, "right")),
  };
  const views = {
    left: { state: states.left },
    center: { state: states.center },
    right: { state: states.right },
  };
  const starts = waveStarts(merge.fields, views);

  for (const pane of ["left", "center", "right"] as const) {
    expect(starts[pane].filter((start) => start !== null)).toEqual(drawnStarts(states[pane]));
  }
  expect(starts.left).not.toEqual(starts.center);
});

function deleting(merge: Merge, cursor: number, spec: TransactionSpec): Merge {
  return after(after(merge, { selection: EditorSelection.cursor(cursor) }), spec);
}

test("Delete at a wave's start or Backspace at its end deletes nothing and shows the next step", async () => {
  const merge = await open();
  const { from, to } = levelOf(merge, 1, 0);
  const top = levelOf(merge, 0, 0);
  const cases = [
    deleting(merge, from, { changes: { from, to }, userEvent: "delete.forward" }),
    deleting(merge, to, { changes: { from, to }, userEvent: "delete.backward" }),
    deleting(merge, from, { changes: { from, to: to + 1 }, userEvent: "delete.line" }),
  ];
  const atTop = deleting(merge, 0, {
    changes: { from: top.from, to: top.to },
    userEvent: "delete.forward",
  });

  for (const done of cases) {
    expect(done.state.doc.eq(merge.state.doc)).toBe(true);
    expect(centerLines(done, 1)).toEqual(["41-62", "49-54"]);
  }
  expect(atTop.state.doc.eq(merge.state.doc)).toBe(true);
  expect(centerLines(atTop, 0)).toEqual(["1-22", "1-14"]);
});

test("delete-line or a line cut on a wave line deletes nothing and shows the next step", async () => {
  const merge = await open();
  const doc = merge.state.doc;
  const { from } = levelOf(merge, 1, 0);
  const line = doc.lineAt(from);
  const cases = [
    deleting(merge, from, { changes: { from: from - 1, to: line.to }, userEvent: "delete.line" }),
    deleting(merge, from, { changes: { from, to: line.to + 1 }, userEvent: "delete.cut" }),
  ];

  for (const done of cases) {
    expect(done.state.doc.eq(doc)).toBe(true);
    expect(centerLines(done, 1)).toEqual(["41-62", "49-54"]);
  }
});

test("a delete of only the line break before a wave still joins the lines", async () => {
  const merge = await open();
  const { from } = levelOf(merge, 1, 0);
  const joined = deleting(merge, from, {
    changes: { from: from - 1, to: from },
    userEvent: "delete.backward",
  });

  expect(joined.state.doc.lines).toBe(merge.state.doc.lines - 1);
});

test("a selection deleted across a wave and a delete beside one still delete", async () => {
  const merge = await open();
  const doc = merge.state.doc;
  const { to } = levelOf(merge, 1, 0);
  const across = after(
    after(merge, { selection: EditorSelection.range(doc.line(36).from, doc.line(68).from) }),
    { changes: { from: doc.line(36).from, to: doc.line(68).from }, userEvent: "delete.selection" },
  );
  const beside = deleting(merge, to + 1, {
    changes: { from: to, to: to + 1 },
    userEvent: "delete.backward",
  });

  expect(across.state.doc.lines).toBe(doc.lines - 32);
  expect(beside.state.doc.lines).toBe(doc.lines - 1);
});

function waves(merge: Merge, pane: Pane, state: EditorState): string[] {
  return paneFolds(merge.fields, pane, state).map((fold) =>
    lineRange(state, displayed(fold, pane)),
  );
}

test("off shows every hidden line in all three panes: no wave, and the sides get zero counts", async () => {
  const merge = await open();
  const off = collapsing(click(merge, 1), false);
  const left = pushed(off, "left", sidePane(merge, "left"));
  const right = pushed(off, "right", sidePane(merge, "right"));

  expect(waves(off, "center", off.state)).toEqual(["-", "-", "-"]);
  expect(drawnStarts(off.state)).toEqual([]);
  expect(left.field(merge.fields.sides)).toEqual([0, 0, 0]);
  expect(right.field(merge.fields.sides)).toEqual([0, 0, 0]);
  expect(waves(off, "left", left)).toEqual(["-", "-", "-"]);
  expect(waves(off, "right", right)).toEqual(["-", "-", "-"]);
  expect(drawnStarts(left)).toEqual([]);
});

test("on after clicks hides every run as at a fresh open, whether it was on or off before", async () => {
  const fresh = await open();
  const clicked = click(click(click(fresh, 1), 1), 0);

  expect(middleFolds(collapsing(clicked, true))).toEqual(middleFolds(fresh));
  expect(middleFolds(collapsing(collapsing(clicked, false), true))).toEqual(middleFolds(fresh));
});

test("lines typed above or inside a run while off move or grow its ranges, which hide when on", async () => {
  const off = collapsing(await open(), false);
  const above = collapsing(after(off, { changes: { from: 0, insert: "new\n" } }), true);
  const at = off.state.doc.line(45).from;
  const inside = collapsing(after(off, { changes: { from: at, insert: "typed\n" } }), true);

  expect([0, 1, 2].map((run) => centerLines(above, run))).toEqual([
    ["2-27", "2-23", "2-15"],
    ["38-67", "42-63", "50-55"],
    ["77-102", "81-102", "89-102"],
  ]);
  expect(centerLines(inside, 1)).toEqual(["37-67", "41-63", "50-55"]);
});

test("a level shrunk below 2 lines while off stays shown when on", async () => {
  const off = collapsing(await open(), false);
  const doc = off.state.doc;
  const deleted = after(off, { changes: { from: doc.line(50).from, to: doc.line(55).from } });
  const on = collapsing(deleted, true);

  expect(centerLines(deleted, 1)).toEqual([]);
  expect(centerLines(on, 1)).toEqual(["37-61", "41-57", "-"]);
});

test("a file opened while off has its runs but hides nothing, and on hides every step", async () => {
  const off = await open(false);
  const fresh = await open();

  expect(off.state.field(off.folds).hiding).toEqual([0, 0, 0]);
  expect(sidePane(off, "left").field(off.fields.sides)).toEqual([0, 0, 0]);
  expect(drawnStarts(off.state)).toEqual([]);
  expect(middleFolds(collapsing(off, true))).toEqual(middleFolds(fresh));
});

test("a toggle is not an undo step: undo after it undoes the earlier edit and leaves the folds", async () => {
  const merge = await open();
  const edited = after(merge, { changes: { from: 0, insert: "x\n" }, userEvent: "input.type" });
  const depth = undoDepth(edited.state);
  const off = collapsing(edited, false);
  const undone = undoneState(off.state);

  expect(depth).toBe(1);
  expect(undoDepth(off.state)).toBe(depth);
  expect(undone.doc.eq(merge.state.doc)).toBe(true);
  expect(undoDepth(undone)).toBe(0);
  expect(undone.field(merge.folds)).toEqual({
    runs: merge.state.field(merge.folds).runs,
    hiding: [0, 0, 0],
  });
});

test("Undo selection after a toggle moved the cursor does not put it back inside the hidden lines", async () => {
  const off = collapsing(await open(), false);
  const inside = after(off, {
    selection: EditorSelection.cursor(off.state.doc.line(50).from + 2),
    userEvent: "select.pointer",
  });
  const on = collapsing(inside, true);
  let undone = on.state;
  undoSelection({
    state: on.state,
    dispatch: (tr) => {
      undone = tr.state;
    },
  });

  expect(on.state.selection.main.head).toBe(off.state.doc.line(37).from);
  expect(undone.field(off.folds).hiding).toEqual([3, 3, 3]);
});

test("after a toggle, clicks show 4, 8, then all, and Delete at a wave shows the next step", async () => {
  const on = collapsing(collapsing(click(await open(), 1), false), true);
  const once = click(on, 1);
  const twice = click(once, 1);
  const { from, to } = levelOf(on, 1, 0);
  const deleted = deleting(on, from, { changes: { from, to }, userEvent: "delete.forward" });

  expect(centerLines(once, 1)).toEqual(["41-62", "49-54"]);
  expect(centerLines(twice, 1)).toEqual(["49-54"]);
  expect(centerLines(click(twice, 1), 1)).toEqual([]);
  expect(deleted.state.doc.eq(on.state.doc)).toBe(true);
  expect(centerLines(deleted, 1)).toEqual(["41-62", "49-54"]);
});

test("on moves a middle cursor inside hidden lines to the wave line's start and drops a selection with an end inside, without showing the run", async () => {
  const off = collapsing(await open(), false);
  const doc = off.state.doc;
  function line(number: number): number {
    return doc.line(number).from;
  }
  function toggled(selection: EditorSelection): EditorState {
    return collapsing(after(off, { selection }), true).state;
  }
  const cursor = toggled(EditorSelection.single(line(50) + 2));
  const headInside = toggled(EditorSelection.single(line(34), line(40)));
  const anchorInside = toggled(EditorSelection.single(line(40), line(68)));
  const covering = toggled(EditorSelection.single(line(34), line(68)));

  for (const state of [cursor, headInside, anchorInside, covering]) {
    expect(state.field(off.folds).hiding).toEqual([3, 3, 3]);
  }
  expect(cursor.selection.main.head).toBe(line(37));
  expect(cursor.selection.main.empty).toBe(true);
  expect(headInside.selection.main.head).toBe(line(37));
  expect(headInside.selection.main.empty).toBe(true);
  expect(anchorInside.selection.main.head).toBe(line(68));
  expect(anchorInside.selection.main.empty).toBe(true);
  expect(covering.selection.main).toMatchObject({ anchor: line(34), head: line(68) });
});
