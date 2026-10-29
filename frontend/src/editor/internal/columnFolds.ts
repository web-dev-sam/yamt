import {
  StateEffect,
  StateField,
  Transaction,
  type EditorState,
  type Extension,
  type Text,
  type TransactionSpec,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import type { Column, Difference, ShownThread, ThreadLine } from "../../ipc";
import type { ColumnViews } from "./compareViews";
import { columnRuns, type ColumnChange, type Fold } from "./foldRuns";
import { revealOnOwner } from "./folds";
import {
  hiddenLevels,
  hidingAll,
  leaveCollapsed,
  leaveCollapsedAfter,
  nextStep,
} from "./foldSteps";
import { revealed, reveals, sameCounts, shown, type FoldSteps, type ShowFolds } from "./foldSteps";
import { paneFoldView } from "./foldView";

export type ColumnSteps = FoldSteps<Column>;

export type ColumnFoldWiring = {
  readonly views: () => ColumnViews;
  readonly hovered: () => number | null;
};

const NO_STEPS: ColumnSteps = { runs: [], hiding: [] };

const showSteps = StateEffect.define<ShowFolds>();
const setSteps = StateEffect.define<ColumnSteps>();

export const ownerSteps = StateField.define<ColumnSteps>({
  create: () => NO_STEPS,
  update(steps, tr) {
    let next = steps;
    for (const effect of tr.effects) {
      if (effect.is(showSteps)) {
        next = shown(next, effect.value);
      } else if (effect.is(setSteps)) {
        next = effect.value;
      }
    }
    return tr.selection === undefined ? next : revealed(next, "left", tr.selection.main);
  },
});

export const mirrorSteps = StateField.define<ColumnSteps>({
  create: () => NO_STEPS,
  update: (steps, tr) => tr.effects.findLast((effect) => effect.is(setSteps))?.value ?? steps,
});

function unchangedLine(line: ThreadLine): ColumnChange | null {
  switch (line.kind) {
    case "removed":
    case "added":
      return null;
    case "unchangedOnLeft":
    case "unchangedOnRight":
      return { left: { start: line.left, len: 1 }, right: { start: line.right, len: 1 } };
    default: {
      const _exhaustive: never = line;
      return _exhaustive;
    }
  }
}

function sameChange(a: ColumnChange, b: ColumnChange): boolean {
  return (
    a.left.start === b.left.start &&
    a.left.len === b.left.len &&
    a.right.start === b.right.start &&
    a.right.len === b.right.len
  );
}

function byStarts(a: ColumnChange, b: ColumnChange): number {
  const left = a.left.start - b.left.start;
  return left === 0 ? a.right.start - b.right.start : left;
}

export function columnChanges(
  differences: readonly Difference[],
  threads: readonly ShownThread[],
): ColumnChange[] {
  const lines = threads.flatMap((thread) => unchangedLine(thread.line) ?? []);
  const sorted = [...lines, ...differences].toSorted(byStarts);
  return sorted
    .filter((change, index) => {
      const previous = sorted[index - 1];
      return previous === undefined || !sameChange(previous, change);
    })
    .map(({ left, right }) => ({ left, right }));
}

export function rangeRuns(
  differences: readonly Difference[],
  threads: readonly ShownThread[],
  docs: Readonly<Record<Column, Text>>,
): Fold<Column>[] {
  return columnRuns(columnChanges(differences, threads), docs);
}

export function columnSteps(state: EditorState, column: Column): ColumnSteps {
  return state.field(column === "left" ? ownerSteps : mirrorSteps);
}

export function hiddenIn(state: EditorState, column: Column): readonly Fold<Column>[] {
  const { runs, hiding } = columnSteps(state, column);
  return hiddenLevels(runs, hiding);
}

const OUT_OF_HISTORY = Transaction.addToHistory.of(false);

export function renewSpec(
  left: EditorState,
  runs: readonly Fold<Column>[],
  collapsed: boolean,
): TransactionSpec {
  const steps = { runs, hiding: hidingAll(runs, collapsed) };
  const spec = { effects: setSteps.of(steps), annotations: OUT_OF_HISTORY };
  const selection = leaveCollapsed(left.selection, steps, "left");
  return selection === null ? spec : { ...spec, selection };
}

function showSpec(shows: readonly ShowFolds[]): TransactionSpec {
  return { effects: shows.map((show) => showSteps.of(show)), annotations: OUT_OF_HISTORY };
}

export function stepSpec(left: EditorState, run: number): TransactionSpec {
  return showSpec([nextStep(left.field(ownerSteps), run)]);
}

export function mirrorSpec(right: EditorState, steps: ColumnSteps): TransactionSpec | null {
  const before = right.field(mirrorSteps);
  const replaced = before.runs !== steps.runs;
  if (!replaced && sameCounts(before.hiding, steps.hiding)) {
    return null;
  }
  const spec = { effects: setSteps.of(steps), annotations: OUT_OF_HISTORY };
  const selection = replaced
    ? leaveCollapsed(right.selection, steps, "right")
    : leaveCollapsedAfter(right.selection, before.hiding, steps, "right");
  return selection === null ? spec : { ...spec, selection };
}

export function rightReveal(right: EditorState): TransactionSpec | null {
  const found = reveals(hiddenIn(right, "right"), "right", right.selection.main);
  return found.length === 0 ? null : showSpec(found);
}

function pushToRight(views: () => ColumnViews): Extension {
  return EditorView.updateListener.of((update) => {
    const steps = update.state.field(ownerSteps);
    if (steps === update.startState.field(ownerSteps)) {
      return;
    }
    const right = views().right;
    const spec = mirrorSpec(right.state, steps);
    if (spec !== null) {
      right.dispatch(spec);
    }
  });
}

export function columnFoldExtension(column: Column, wiring: ColumnFoldWiring): Extension {
  const field = column === "left" ? ownerSteps : mirrorSteps;
  const view = paneFoldView(
    { field, folds: (state) => hiddenIn(state, column) },
    column,
    wiring.hovered,
  );
  return column === "left"
    ? [ownerSteps, view, pushToRight(wiring.views)]
    : [mirrorSteps, view, revealOnOwner(rightReveal, () => wiring.views().left)];
}
