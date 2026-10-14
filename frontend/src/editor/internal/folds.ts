import {
  EditorState,
  StateEffect,
  StateField,
  Transaction,
  type ChangeDesc,
  type Extension,
  type SelectionRange,
  type Text,
  type TransactionSpec,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { toDocPos, type DocPos } from "./docPos";
import { displayed, MIN_HIDDEN_LINES, sameHidden } from "./foldRuns";
import type { Fold, FoldLevel, Hidden } from "./foldRuns";
import type { Pane, PaneViews } from "./geometry";

type ShowFolds = { readonly run: number; readonly keep: number };

export type FoldFields = {
  readonly runs: readonly Fold[];
  readonly center: StateField<readonly Fold[]>;
  readonly sides: StateField<readonly number[]>;
};

export const showFolds = StateEffect.define<ShowFolds>();
const showSideFolds = StateEffect.define<readonly number[]>();

function mapHidden(hidden: Hidden, changes: ChangeDesc, doc: Text): Hidden | null {
  const from = changes.mapPos(hidden.from, 1);
  const to = changes.mapPos(hidden.to, -1);
  const fromLine = doc.lineAt(from);
  const toLine = doc.lineAt(to);
  const first = fromLine.from === from ? fromLine.number : fromLine.number + 1;
  const last = toLine.to === to ? toLine.number : toLine.number - 1;
  if (last - first + 1 < MIN_HIDDEN_LINES) {
    return null;
  }
  return { from: toDocPos(doc.line(first).from), to: toDocPos(doc.line(last).to) };
}

function mapLevels(
  levels: readonly FoldLevel[],
  changes: ChangeDesc,
  doc: Text,
): readonly FoldLevel[] {
  let outerShown = false;
  const mapped = levels.map((level) => {
    const center =
      outerShown || level.center === null ? null : mapHidden(level.center, changes, doc);
    outerShown = center === null;
    return sameHidden(center, level.center) ? level : { ...level, center };
  });
  return mapped.every((level, index) => level === levels[index]) ? levels : mapped;
}

function mapFolds(folds: readonly Fold[], changes: ChangeDesc, doc: Text): readonly Fold[] {
  const mapped = folds.map((fold) => {
    const hidden = mapLevels(fold.hidden, changes, doc);
    return hidden === fold.hidden ? fold : { hidden };
  });
  return mapped.every((fold, index) => fold === folds[index]) ? folds : mapped;
}

function innermost(levels: readonly FoldLevel[], count: number): readonly FoldLevel[] {
  return levels.slice(Math.max(0, levels.length - count));
}

function shown(folds: readonly Fold[], { run, keep }: ShowFolds): readonly Fold[] {
  const fold = folds[run];
  if (fold === undefined || Math.max(0, keep) >= fold.hidden.length) {
    return folds;
  }
  const hidden = innermost(fold.hidden, keep);
  return folds.map((other, index) => (index === run ? { hidden } : other));
}

export function paneFolds(fields: FoldFields, pane: Pane, state: EditorState): readonly Fold[] {
  if (pane === "center") {
    return state.field(fields.center);
  }
  const counts = state.field(fields.sides);
  return fields.runs.map(({ hidden }, run) => ({
    hidden: innermost(hidden, counts[run] ?? hidden.length),
  }));
}

function startsIn(fields: FoldFields, pane: Pane, state: EditorState): (DocPos | null)[] {
  return paneFolds(fields, pane, state).map((fold) => displayed(fold, pane)?.from ?? null);
}

export function waveStarts(
  fields: FoldFields,
  views: Readonly<Record<Pane, Pick<EditorView, "state">>>,
): Record<Pane, (DocPos | null)[]> {
  return {
    left: startsIn(fields, "left", views.left.state),
    center: startsIn(fields, "center", views.center.state),
    right: startsIn(fields, "right", views.right.state),
  };
}

function holds({ from, to }: Hidden, selection: SelectionRange): boolean {
  const { anchor, head } = selection;
  return (
    (anchor > from && anchor < to) ||
    (head > from && head < to) ||
    (!selection.empty && selection.from >= from && selection.to <= to)
  );
}

export function revealKeep(
  levels: readonly (Hidden | null)[],
  selection: SelectionRange,
): number | null {
  const found = levels.findLastIndex((hidden) => hidden !== null && holds(hidden, selection));
  return found < 0 ? null : levels.length - found - 1;
}

function reveals(folds: readonly Fold[], pane: Pane, selection: SelectionRange): ShowFolds[] {
  return folds.flatMap((fold, run) => {
    const keep = revealKeep(
      fold.hidden.map((level) => level[pane]),
      selection,
    );
    return keep === null ? [] : [{ run, keep }];
  });
}

export function foldField(initial: readonly Fold[]): StateField<readonly Fold[]> {
  return StateField.define<readonly Fold[]>({
    create: () => initial,
    update(folds, tr) {
      let next = tr.docChanged ? mapFolds(folds, tr.changes, tr.state.doc) : folds;
      for (const effect of tr.effects) {
        if (effect.is(showFolds)) {
          next = shown(next, effect.value);
        }
      }
      if (tr.selection !== undefined) {
        for (const reveal of reveals(next, "center", tr.selection.main)) {
          next = shown(next, reveal);
        }
      }
      return next;
    },
  });
}

function sideFoldField(runs: readonly Fold[]): StateField<readonly number[]> {
  return StateField.define<readonly number[]>({
    create: () => runs.map((fold) => fold.hidden.length),
    update: (counts, tr) =>
      tr.effects.findLast((effect) => effect.is(showSideFolds))?.value ?? counts,
  });
}

export function foldFields(runs: readonly Fold[]): FoldFields {
  return { runs, center: foldField(runs), sides: sideFoldField(runs) };
}

function showSpec(shows: readonly ShowFolds[]): TransactionSpec {
  return {
    effects: shows.map((show) => showFolds.of(show)),
    annotations: Transaction.addToHistory.of(false),
  };
}

function nextStep(folds: readonly Fold[], run: number): ShowFolds {
  return { run, keep: (folds[run]?.hidden.length ?? 0) - 1 };
}

export function showNextStep(folds: readonly Fold[], run: number): TransactionSpec {
  return showSpec([nextStep(folds, run)]);
}

function removesHidden(tr: Transaction, { from, to }: Hidden): boolean {
  let removes = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    removes ||= Math.max(fromA, from) < Math.min(toA, to);
  });
  return removes;
}

function deletedWaves(tr: Transaction, folds: readonly Fold[]): ShowFolds[] {
  if (!tr.isUserEvent("delete") || tr.startState.selection.ranges.some((range) => !range.empty)) {
    return [];
  }
  return folds.flatMap((fold, run) => {
    const hidden = displayed(fold, "center");
    return hidden !== null && removesHidden(tr, hidden) ? [nextStep(folds, run)] : [];
  });
}

export function waveDeletes(field: StateField<readonly Fold[]>): Extension {
  return EditorState.transactionFilter.of((tr) => {
    const steps = deletedWaves(tr, tr.startState.field(field));
    return steps.length === 0 ? tr : showSpec(steps);
  });
}

export function sideFoldPush(
  onSides: readonly number[],
  folds: readonly Fold[],
): StateEffect<readonly number[]> | null {
  if (folds.every((fold, run) => fold.hidden.length === onSides[run])) {
    return null;
  }
  return showSideFolds.of(folds.map((fold) => fold.hidden.length));
}

export function pushFolds(fields: FoldFields, views: () => PaneViews): Extension {
  return EditorView.updateListener.of((update) => {
    const folds = update.state.field(fields.center);
    if (folds === update.startState.field(fields.center)) {
      return;
    }
    const { left, right } = views();
    const effect = sideFoldPush(left.state.field(fields.sides), folds);
    if (effect !== null) {
      left.dispatch({ effects: effect });
      right.dispatch({ effects: effect });
    }
  });
}

export function sideReveal(
  fields: FoldFields,
  pane: "left" | "right",
  state: EditorState,
): TransactionSpec | null {
  const found = reveals(paneFolds(fields, pane, state), pane, state.selection.main);
  return found.length === 0 ? null : showSpec(found);
}

export function sideReveals(
  fields: FoldFields,
  pane: "left" | "right",
  center: () => EditorView,
): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet) {
      return;
    }
    const spec = sideReveal(fields, pane, update.state);
    if (spec === null) {
      return;
    }
    center().dispatch(spec);
    update.view.dispatch({
      effects: EditorView.scrollIntoView(update.state.selection.main, { y: "center" }),
    });
  });
}
