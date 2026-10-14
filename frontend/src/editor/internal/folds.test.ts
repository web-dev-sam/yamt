import { undo } from "@codemirror/commands";
import {
  EditorSelection,
  type EditorState,
  type StateField,
  type TransactionSpec,
} from "@codemirror/state";
import { expect, test } from "vitest";

import { DEFAULT_KEYS, loadFixture, type FileMergeData } from "../../ipc";
import { actionSteps, bulkApplySteps, dispatchSteps, type ApplyTarget } from "./apply";
import { chunkField } from "./chunkField";
import { selectMatch } from "./findMatch";
import { foldRuns, type Fold, type Hidden } from "./foldRuns";
import {
  foldField,
  revealKeep,
  showFolds,
  showNextStep,
  sideFoldField,
  sideFoldPush,
} from "./folds";
import { paneState, type PaneSettings } from "./pane";
import { paneDocs } from "./paneDocs";

const SETTINGS: PaneSettings = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  platform: "Linux x86_64",
};

type Merge = ApplyTarget & {
  readonly folds: StateField<readonly Fold[]>;
  readonly runs: Fold[];
};

function numbered(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `line ${from + index}`);
}

function noWords(id: number) {
  return {
    chunk: id,
    local: { changed: [], removed_at: [] },
    remote: { changed: [], removed_at: [] },
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
      },
    ],
  };
  return loadFixture("synthetic.ts", { "synthetic.json": record });
}

async function open(): Promise<Merge> {
  const data = await twoChanges();
  const docs = paneDocs(data);
  const runs = foldRuns(data.chunks, docs);
  const field = chunkField(data.chunks);
  const folds = foldField(runs);
  const state = paneState({
    kind: "center",
    doc: docs.center,
    eol: data.eol,
    language: null,
    settings: SETTINGS,
    extensions: [field, folds],
  });
  return { state, field, folds, runs, sides: { local: docs.left, remote: docs.right } };
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

function centerLines(merge: Merge, run: number): string[] {
  const fold = merge.state.field(merge.folds)[run];
  return fold === undefined ? [] : fold.hidden.map((level) => lineRange(merge.state, level.center));
}

function hiddenTexts(merge: Merge): string[] {
  return merge.state
    .field(merge.folds)
    .flatMap((fold) =>
      fold.hidden.map(({ center }) =>
        center === null ? "-" : merge.state.sliceDoc(center.from, center.to),
      ),
    );
}

function levelOf(merge: Merge, run: number, level: number): Hidden {
  const hidden = merge.state.field(merge.folds)[run]?.hidden[level]?.center;
  if (hidden === undefined || hidden === null) {
    throw new Error(`run ${run} has no level ${level} in the middle`);
  }
  return hidden;
}

function click(merge: Merge, run: number): Merge {
  return after(merge, showNextStep(merge.state.field(merge.folds), run));
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
  expect(applied.state.field(merge.folds).map((fold) => fold.hidden.length)).toEqual([3, 3, 3]);
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

test("a side and the middle reveal the same levels for the same ranges", async () => {
  const { runs } = await open();
  const top = runs[0];
  if (top === undefined) {
    throw new Error("no first run");
  }
  const left = top.hidden.map((level) => level.left);
  const center = top.hidden.map((level) => level.center);

  const keeps = [50, 150, 180, 400].map((pos) => {
    const at = EditorSelection.cursor(pos);
    expect(revealKeep(left, at)).toBe(revealKeep(center, at));
    return revealKeep(center, at);
  });

  expect(keeps).toEqual([0, 1, 2, null]);
  expect(revealKeep(center, EditorSelection.range(0, 500))).toBeNull();
});

test("the sides are told the counts only when they differ, and mirror them", async () => {
  const merge = await open();
  const sides = sideFoldField(merge.runs);
  const side = paneState({
    kind: "side",
    doc: merge.sides.local,
    eol: "Lf",
    language: null,
    settings: SETTINGS,
    extensions: sides,
  });
  const clicked = click(merge, 1).state.field(merge.folds);
  const effect = sideFoldPush(side.field(sides), clicked);
  const mirrored = effect === null ? side : side.update({ effects: effect }).state;

  expect(sideFoldPush(side.field(sides), merge.state.field(merge.folds))).toBeNull();
  expect(mirrored.field(sides).map((fold) => fold.hidden.length)).toEqual([3, 2, 3]);
  expect(mirrored.field(sides)[1]?.hidden).toEqual(merge.runs[1]?.hidden.slice(1));
  expect(sideFoldPush(mirrored.field(sides), clicked)).toBeNull();
});
