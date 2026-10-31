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

import type { Column, Difference, ShownThread } from "../../ipc";
import type { ColumnViews } from "./compareViews";
import { unchangedRuns } from "./diffOrder";
import { columnRuns, type ColumnChange, type Fold, type LineSpan } from "./foldRuns";
import { revealOnOwner } from "./folds";
import {
  displayedIn,
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

function byStarts(a: ColumnChange, b: ColumnChange): number {
  const left = a.left.start - b.left.start;
  return left === 0 ? a.right.start - b.right.start : left;
}

function end(span: LineSpan): number {
  return span.start + span.len;
}

function joined(a: ColumnChange, b: ColumnChange): ColumnChange | null {
  if (b.left.start > end(a.left) || b.right.start > end(a.right)) {
    return null;
  }
  return {
    left: { start: a.left.start, len: Math.max(end(a.left), end(b.left)) - a.left.start },
    right: { start: a.right.start, len: Math.max(end(a.right), end(b.right)) - a.right.start },
  };
}

function merged(runs: readonly ColumnChange[]): ColumnChange[] {
  const out: ColumnChange[] = [];
  for (const run of runs.toSorted(byStarts)) {
    const last = out.at(-1);
    const both = last === undefined ? null : joined(last, run);
    if (both === null) {
      out.push(run);
    } else {
      out[out.length - 1] = both;
    }
  }
  return out;
}

export function columnChanges(
  differences: readonly Difference[],
  threads: readonly ShownThread[],
): ColumnChange[] {
  const runs = merged(threads.flatMap((thread) => unchangedRuns(differences, thread.place)));
  const changes = differences.map(({ left, right }) => ({ left, right }));
  return [...runs, ...changes].toSorted(byStarts);
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

export function hiddenLeft(left: EditorState): LineSpan[] {
  const { doc } = left;
  return displayedIn(hiddenIn(left, "left"), "left").map(({ from, to }) => {
    const start = doc.lineAt(from).number - 1;
    return { start, len: doc.lineAt(to).number - start };
  });
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
