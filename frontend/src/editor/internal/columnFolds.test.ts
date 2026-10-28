import {
  EditorSelection,
  EditorState,
  Text,
  Transaction,
  type TransactionSpec,
} from "@codemirror/state";
import { expect, test } from "vitest";

import {
  changedThreadLine,
  loadCompareFixture,
  unchangedThreadLine,
  type Column,
  type ShownThread,
} from "../../ipc";
import {
  columnChanges,
  columnFoldExtension,
  columnSteps,
  mirrorSpec,
  ownerSteps,
  rangeRuns,
  renewSpec,
  rightReveal,
  stepSpec,
  mirrorSteps,
} from "./columnFolds";
import { selectMatch } from "./findMatch";
import { displayed, type Fold, type Hidden, type LineSpan } from "./foldRuns";
import { displayedIn, hiddenLevels } from "./foldSteps";

function numbered(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `line ${from + index}`);
}

const LEFT_LINES = numbered(1, 100);
const RIGHT_LINES = [
  ...numbered(1, 30),
  "new a",
  "new b",
  ...numbered(32, 70),
  "added",
  ...numbered(71, 100),
];
const DOCS: Readonly<Record<Column, Text>> = {
  left: Text.of(LEFT_LINES),
  right: Text.of(RIGHT_LINES),
};
const NO_WORDS = { changed: [], removals: [] };
const { comparison } = await loadCompareFixture("pair", {
  "pair.json": {
    left: LEFT_LINES.join("\n"),
    right: RIGHT_LINES.join("\n"),
    differences: [
      {
        left: { start: 30, len: 1 },
        right: { start: 30, len: 2 },
        words: { left: NO_WORDS, right: NO_WORDS },
      },
      {
        left: { start: 70, len: 0 },
        right: { start: 71, len: 1 },
        words: { left: NO_WORDS, right: NO_WORDS },
      },
    ],
  },
});
const DIFFERENCES = comparison.differences;

type Pair = { readonly left: EditorState; readonly right: EditorState };

function noViews(): never {
  throw new Error("a state test has no views");
}

const WIRING = { views: noViews, hovered: () => null };

function fresh(): Pair {
  return {
    left: EditorState.create({ doc: DOCS.left, extensions: columnFoldExtension("left", WIRING) }),
    right: EditorState.create({
      doc: DOCS.right,
      extensions: columnFoldExtension("right", WIRING),
    }),
  };
}

function onLeft(pair: Pair, ...specs: TransactionSpec[]): Pair {
  const left = pair.left.update(...specs).state;
  const spec = mirrorSpec(pair.right, left.field(ownerSteps));
  return { left, right: spec === null ? pair.right : pair.right.update(spec).state };
}

function onRight(pair: Pair, spec: TransactionSpec): Pair {
  const right = pair.right.update(spec).state;
  const reveal = rightReveal(right);
  return reveal === null ? { ...pair, right } : onLeft({ ...pair, right }, reveal);
}

function opened(threads: readonly ShownThread[] = [], collapsed = true): Pair {
  const pair = fresh();
  return onLeft(pair, renewSpec(pair.left, rangeRuns(DIFFERENCES, threads, DOCS), collapsed));
}

function renewed(pair: Pair, collapsed: boolean, threads: readonly ShownThread[] = []): Pair {
  return onLeft(pair, renewSpec(pair.left, rangeRuns(DIFFERENCES, threads, DOCS), collapsed));
}

function click(pair: Pair, run: number): Pair {
  return onLeft(pair, stepSpec(pair.left, run));
}

function lineRange(doc: Text, hidden: Hidden | null): string {
  return hidden === null
    ? "-"
    : `${doc.lineAt(hidden.from).number}-${doc.lineAt(hidden.to).number}`;
}

function hiddenNow(state: EditorState, column: Column): readonly Fold<Column>[] {
  const { runs, hiding } = columnSteps(state, column);
  return hiddenLevels(runs, hiding);
}

function waves(state: EditorState, column: Column): string[] {
  return hiddenNow(state, column).map((fold) => lineRange(state.doc, displayed(fold, column)));
}

function levels(state: EditorState, column: Column, run: number): string[] {
  const fold = hiddenNow(state, column)[run];
  return fold === undefined ? [] : fold.hidden.map((level) => lineRange(state.doc, level[column]));
}

function allLevels(runs: readonly Fold<Column>[], column: Column): string[][] {
  return runs.map((fold) => fold.hidden.map((level) => lineRange(DOCS[column], level[column])));
}

const COLUMNS: readonly Column[] = ["left", "right"];

function thread(
  column: Column,
  lines: { readonly left: number; readonly right: number },
  shown: ShownThread["shown"],
): ShownThread {
  return {
    key: `${column} ${lines.left} ${shown}`,
    line: unchangedThreadLine(column, lines),
    shown,
  };
}

function outerLevel(state: EditorState, column: Column, run: number): Hidden {
  const hidden = hiddenNow(state, column)[run]?.hidden[0]?.[column];
  if (hidden === undefined || hidden === null) {
    throw new Error(`run ${run} hides nothing in the ${column} column`);
  }
  return hidden;
}

function at(state: EditorState, line: number, offset = 0): number {
  return state.doc.line(line).from + offset;
}

test("runs come from the differences per column: before the first, between two, after the last", () => {
  const pair = opened();

  expect(waves(pair.left, "left")).toEqual(["1-26", "36-66", "75-100"]);
  expect(waves(pair.right, "right")).toEqual(["1-26", "37-67", "77-102"]);
});

test("each run keeps 4, 8 and 16 lines next to each change and none at the file's edges, in both columns", () => {
  const runs = rangeRuns(DIFFERENCES, [], DOCS);

  expect(allLevels(runs, "left")).toEqual([
    ["1-26", "1-22", "1-14"],
    ["36-66", "40-62", "48-54"],
    ["75-100", "79-100", "87-100"],
  ]);
  expect(allLevels(runs, "right")).toEqual([
    ["1-26", "1-22", "1-14"],
    ["37-67", "41-63", "49-55"],
    ["77-102", "81-102", "89-102"],
  ]);
});

test("a stretch under 2 lines hides nothing and a level equal to the one outside it is dropped", async () => {
  const lines = numbered(1, 30);
  const docs = { left: Text.of(lines), right: Text.of(lines) };
  const loaded = await loadCompareFixture("short", {
    "short.json": {
      left: lines.join("\n"),
      right: lines.join("\n"),
      differences: [0, 10, 21].map((start) => ({
        left: { start, len: 1 },
        right: { start, len: 1 },
        words: { left: NO_WORDS, right: NO_WORDS },
      })),
    },
  });
  const runs = rangeRuns(loaded.comparison.differences, [], docs);
  const unchanged = rangeRuns([], [], docs);

  expect(allLevels(runs, "left")).toEqual([[], [], ["16-17"], ["27-30"]]);
  expect(allLevels(runs, "right")).toEqual(allLevels(runs, "left"));
  expect(allLevels(unchanged, "left")).toEqual([["1-30"]]);
  expect(allLevels(unchanged, "right")).toEqual([["1-30"]]);
});

test.each(COLUMNS)(
  "a thread on an unchanged line in the %s column splits its stretch and keeps 4 lines around it in both columns — open, collapsed and draft alike",
  (column) => {
    for (const shown of ["open", "collapsed", "draft"] as const) {
      const pair = opened([thread(column, { left: 50, right: 51 }, shown)]);

      expect(waves(pair.left, "left")).toEqual(["1-26", "36-46", "56-66", "75-100"]);
      expect(waves(pair.right, "right")).toEqual(["1-26", "37-47", "57-67", "77-102"]);
      expect(pair.left.doc.line(51).text).toBe(pair.right.doc.line(52).text);
    }
  },
);

test("threads on removed or added lines change no run", () => {
  const removed: ShownThread = { key: "r", line: changedThreadLine("left", 30), shown: "open" };
  const added: ShownThread = { key: "a", line: changedThreadLine("right", 71), shown: "draft" };
  const runs = rangeRuns(DIFFERENCES, [removed, added], DOCS);
  const plain = rangeRuns(DIFFERENCES, [], DOCS);

  expect(columnChanges(DIFFERENCES, [removed, added])).toHaveLength(DIFFERENCES.length);
  expect(allLevels(runs, "left")).toEqual(allLevels(plain, "left"));
  expect(allLevels(runs, "right")).toEqual(allLevels(plain, "right"));
});

test("a thread on the line after an insertion point sorts after the difference and stays shown", () => {
  const after = thread("left", { left: 70, right: 72 }, "open");
  const starts = columnChanges(DIFFERENCES, [after]).map(({ left, right }) => [
    left.start,
    right.start,
  ]);
  const pair = opened([after]);

  expect(starts).toEqual([
    [30, 30],
    [70, 71],
    [70, 72],
  ]);
  expect(waves(pair.left, "left")).toEqual(["1-26", "36-66", "-", "76-100"]);
  expect(waves(pair.right, "right")).toEqual(["1-26", "37-67", "-", "78-102"]);
});

const SAME_LINE_COLUMNS: readonly (readonly [Column, Column])[] = [
  ["left", "left"],
  ["right", "right"],
  ["left", "right"],
];

test.each(SAME_LINE_COLUMNS)(
  "two threads on one line make one change: %s column and %s column",
  (first, second) => {
    const changes = columnChanges(DIFFERENCES, [
      thread(first, { left: 50, right: 51 }, "open"),
      thread(second, { left: 50, right: 51 }, "collapsed"),
    ]);

    const threadLines: Readonly<Record<Column, LineSpan>> = {
      left: { start: 50, len: 1 },
      right: { start: 51, len: 1 },
    };

    expect(changes).toHaveLength(DIFFERENCES.length + 1);
    expect(changes).toContainEqual(threadLines);
  },
);

test("a step on a run shows its next step in both columns, owner then mirror", () => {
  const once = click(opened(), 1);
  const twice = click(once, 1);

  expect(levels(once.left, "left", 1)).toEqual(["40-62", "48-54"]);
  expect(levels(once.right, "right", 1)).toEqual(["41-63", "49-55"]);
  expect(levels(twice.left, "left", 1)).toEqual(["48-54"]);
  expect(levels(twice.right, "right", 1)).toEqual(["49-55"]);
  expect(columnSteps(twice.right, "right").hiding).toEqual([3, 1, 3]);
});

test("the right column numbers runs as the left does", () => {
  const pair = click(click(opened(), 2), 2);
  const left = columnSteps(pair.left, "left");
  const right = columnSteps(pair.right, "right");

  expect(right.runs).toBe(left.runs);
  expect(right.hiding).toEqual(left.hiding);
  expect(waves(pair.right, "right")).toEqual(["1-26", "37-67", "89-102"]);
  expect(waves(pair.left, "left")).toEqual(["1-26", "36-66", "87-100"]);
});

test("on hides every run back to its start whatever steps were shown, off shows every line, in both columns", () => {
  const fresh = opened();
  const clicked = click(click(click(fresh, 1), 1), 0);
  const off = renewed(clicked, false);
  const on = renewed(clicked, true);
  const offOn = renewed(off, true);

  expect(waves(off.left, "left")).toEqual(["-", "-", "-"]);
  expect(waves(off.right, "right")).toEqual(["-", "-", "-"]);
  expect(columnSteps(off.right, "right").hiding).toEqual([0, 0, 0]);
  expect(displayedIn(hiddenNow(off.left, "left"), "left")).toEqual([]);
  expect(displayedIn(hiddenNow(off.right, "right"), "right")).toEqual([]);
  for (const pair of [on, offOn]) {
    expect(allLevels(hiddenNow(pair.left, "left"), "left")).toEqual(
      allLevels(hiddenNow(fresh.left, "left"), "left"),
    );
    expect(columnSteps(pair.right, "right").hiding).toEqual([3, 3, 3]);
    expect(waves(pair.right, "right")).toEqual(waves(fresh.right, "right"));
  }
});

test("runs given at a renew replace the old ones and a mirror copy leaves counts alone otherwise", () => {
  const off = opened([], false);
  const again = renewed(off, false);
  const withThread = renewed(opened(), true, [thread("left", { left: 50, right: 51 }, "open")]);
  const moved = onLeft(withThread, { selection: EditorSelection.cursor(0) });

  expect(columnSteps(again.left, "left").runs).not.toBe(columnSteps(off.left, "left").runs);
  expect(again.right.field(mirrorSteps).runs).toBe(columnSteps(again.left, "left").runs);
  expect(waves(withThread.right, "right")).toEqual(["1-26", "37-47", "57-67", "77-102"]);
  expect(mirrorSpec(withThread.right, withThread.left.field(ownerSteps))).toBeNull();
  expect(moved.right).toBe(withThread.right);
});

test("at a renew a cursor in lines that get hidden moves to the wave line's start and a selection with an end inside is dropped, left and right", () => {
  const off = opened([], false);
  function toggled(column: Column, selection: EditorSelection): EditorState {
    const pair =
      column === "left"
        ? { ...off, left: off.left.update({ selection }).state }
        : { ...off, right: off.right.update({ selection }).state };
    const on = renewed(pair, true);
    expect(columnSteps(on.left, "left").hiding).toEqual([3, 3, 3]);
    return on[column];
  }
  const left = toggled("left", EditorSelection.single(at(off.left, 50, 2)));
  const leftHead = toggled("left", EditorSelection.single(at(off.left, 33), at(off.left, 40)));
  const right = toggled("right", EditorSelection.single(at(off.right, 50, 2)));
  const rightAnchor = toggled(
    "right",
    EditorSelection.single(at(off.right, 40), at(off.right, 69)),
  );

  expect(left.selection.main).toMatchObject({ anchor: at(left, 36), head: at(left, 36) });
  expect(leftHead.selection.main).toMatchObject({ anchor: at(left, 36), head: at(left, 36) });
  expect(right.selection.main).toMatchObject({ anchor: at(right, 37), head: at(right, 37) });
  expect(rightAnchor.selection.main).toMatchObject({
    anchor: at(right, 69),
    head: at(right, 69),
  });
});

test("counts that only shrink leave the right column's cursor alone", () => {
  const pair = opened();
  const inside = at(pair.right, 50, 2);
  const placed = { ...pair, right: pair.right.update({ selection: { anchor: inside } }).state };
  const clicked = click(placed, 1);

  expect(columnSteps(clicked.right, "right").hiding).toEqual([3, 2, 3]);
  expect(clicked.right.selection.main.head).toBe(inside);
});

test("a selection end strictly inside hidden lines shows every range holding it, from the left and from the right", () => {
  const pair = opened();
  const deepLeft = onLeft(pair, { selection: { anchor: at(pair.left, 50, 2) } });
  const deepRight = onRight(pair, { selection: { anchor: at(pair.right, 51, 2) } });
  const shallowRight = onRight(pair, {
    selection: { anchor: at(pair.right, 30), head: at(pair.right, 39, 1) },
  });
  const pastLeftEnd = onRight(pair, { selection: { anchor: at(pair.right, 102, 1) } });

  expect(levels(deepLeft.left, "left", 1)).toEqual([]);
  expect(levels(deepLeft.right, "right", 1)).toEqual([]);
  expect(levels(deepRight.left, "left", 1)).toEqual([]);
  expect(levels(deepRight.right, "right", 1)).toEqual([]);
  expect(levels(shallowRight.left, "left", 1)).toEqual(["40-62", "48-54"]);
  expect(levels(shallowRight.right, "right", 1)).toEqual(["41-63", "49-55"]);
  expect(levels(shallowRight.right, "right", 0)).toEqual(["1-26", "1-22", "1-14"]);
  expect(pair.left.doc.length).toBeLessThan(at(pair.right, 102, 1));
  expect(levels(pastLeftEnd.right, "right", 2)).toEqual([]);
  expect(levels(pastLeftEnd.left, "left", 2)).toEqual([]);
});

test("select-all, the document's start and end, and a cursor on a wave line's edges reveal nothing", () => {
  const pair = opened();
  for (const column of ["left", "right"] as const) {
    const state = pair[column];
    const { from, to } = outerLevel(state, column, 1);
    const selections = [
      EditorSelection.single(0, state.doc.length),
      EditorSelection.single(0),
      EditorSelection.single(state.doc.length),
      EditorSelection.single(from),
      EditorSelection.single(to),
    ];
    for (const selection of selections) {
      const moved = column === "left" ? onLeft(pair, { selection }) : onRight(pair, { selection });
      expect(moved.left.field(ownerSteps)).toBe(pair.left.field(ownerSteps));
    }
  }
});

test("a search match inside hidden lines reveals it in both columns", () => {
  const pair = opened();
  const leftLine = pair.left.doc.line(50);
  const rightLine = pair.right.doc.line(45);
  const fromLeft = onLeft(pair, selectMatch({ from: leftLine.from + 1, to: leftLine.to }));
  const fromRight = onRight(pair, selectMatch({ from: rightLine.from, to: rightLine.to }));

  expect(levels(fromLeft.left, "left", 1)).toEqual([]);
  expect(levels(fromLeft.right, "right", 1)).toEqual([]);
  expect(levels(fromRight.right, "right", 1)).toEqual(["49-55"]);
  expect(levels(fromRight.left, "left", 1)).toEqual(["48-54"]);
});

test("every fold transaction is out of history", () => {
  const pair = fresh();
  const runs = rangeRuns(DIFFERENCES, [], DOCS);
  const renew = pair.left.update(renewSpec(pair.left, runs, true));
  const step = renew.state.update(stepSpec(renew.state, 1));
  const mirror = mirrorSpec(pair.right, step.state.field(ownerSteps));
  const right = pair.right.update(mirror ?? {}).state;
  const reveal = rightReveal(right.update({ selection: { anchor: at(right, 10, 1) } }).state);
  const transactions = [
    renew,
    step,
    pair.right.update(mirror ?? {}),
    step.state.update(reveal ?? {}),
  ];

  expect(mirror).not.toBeNull();
  expect(reveal).not.toBeNull();
  for (const tr of transactions) {
    expect(tr.annotation(Transaction.addToHistory)).toBe(false);
  }
});
