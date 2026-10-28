import type { EditorSelection, SelectionRange } from "@codemirror/state";

import { displayed, type Fold, type Hidden } from "./foldRuns";
import { leaveAllHidden, revealKeep } from "./foldSelection";

export type ShowFolds = { readonly run: number; readonly keep: number };

export type FoldSteps<P extends string> = {
  readonly runs: readonly Fold<P>[];
  readonly hiding: readonly number[];
};

export function hidingAll<P extends string>(
  runs: readonly Fold<P>[],
  collapsed: boolean,
): readonly number[] {
  return runs.map((fold) => (collapsed ? fold.hidden.length : 0));
}

export function sameCounts(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((count, run) => count === b[run]);
}

export function hiddenLevels<P extends string>(
  runs: readonly Fold<P>[],
  counts: readonly number[],
): readonly Fold<P>[] {
  return runs.map(({ hidden }, run) => ({
    hidden: hidden.slice(Math.max(0, hidden.length - (counts[run] ?? 0))),
  }));
}

export function displayedIn<P extends string>(folds: readonly Fold<P>[], pane: P): Hidden[] {
  return folds.flatMap((fold) => displayed(fold, pane) ?? []);
}

export function shown<P extends string>(
  steps: FoldSteps<P>,
  { run, keep }: ShowFolds,
): FoldSteps<P> {
  const count = steps.hiding[run];
  if (count === undefined || Math.max(0, keep) >= count) {
    return steps;
  }
  const hiding = steps.hiding.map((other, index) => (index === run ? Math.max(0, keep) : other));
  return { ...steps, hiding };
}

export function nextStep<P extends string>(steps: FoldSteps<P>, run: number): ShowFolds {
  return { run, keep: (steps.hiding[run] ?? 0) - 1 };
}

export function reveals<P extends string>(
  folds: readonly Fold<P>[],
  pane: P,
  selection: SelectionRange,
): ShowFolds[] {
  return folds.flatMap((fold, run) => {
    const keep = revealKeep(
      fold.hidden.map((level) => level[pane]),
      selection,
    );
    return keep === null ? [] : [{ run, keep }];
  });
}

export function leaveCollapsed<P extends string>(
  selection: EditorSelection,
  steps: FoldSteps<P>,
  pane: P,
): EditorSelection | null {
  return leaveAllHidden(selection, displayedIn(hiddenLevels(steps.runs, steps.hiding), pane));
}
