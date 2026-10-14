import {
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

import { toDocPos } from "./docPos";
import { MIN_HIDDEN_LINES, sameHidden, type Fold, type FoldLevel, type Hidden } from "./foldRuns";
import type { Pane, PaneViews } from "./geometry";

type ShowFolds = { readonly run: number; readonly keep: number };

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

function shown(folds: readonly Fold[], { run, keep }: ShowFolds): readonly Fold[] {
  const fold = folds[run];
  const kept = Math.max(0, keep);
  if (fold === undefined || kept >= fold.hidden.length) {
    return folds;
  }
  const hidden = fold.hidden.slice(fold.hidden.length - kept);
  return folds.map((other, index) => (index === run ? { hidden } : other));
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
  const innermost = levels.findLastIndex((hidden) => hidden !== null && holds(hidden, selection));
  return innermost < 0 ? null : levels.length - innermost - 1;
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

function showSpec(shows: readonly ShowFolds[]): TransactionSpec {
  return {
    effects: shows.map((show) => showFolds.of(show)),
    annotations: Transaction.addToHistory.of(false),
  };
}

export function showNextStep(folds: readonly Fold[], run: number): TransactionSpec {
  return showSpec([{ run, keep: (folds[run]?.hidden.length ?? 0) - 1 }]);
}

export function sideFoldField(initial: readonly Fold[]): StateField<readonly Fold[]> {
  return StateField.define<readonly Fold[]>({
    create: () => initial,
    update(folds, tr) {
      const counts = tr.effects.findLast((effect) => effect.is(showSideFolds))?.value;
      if (counts === undefined) {
        return folds;
      }
      return initial.map(({ hidden }, run) => ({
        hidden: hidden.slice(Math.max(0, hidden.length - (counts[run] ?? hidden.length))),
      }));
    },
  });
}

export function sideFoldPush(
  onSides: readonly Fold[],
  folds: readonly Fold[],
): StateEffect<readonly number[]> | null {
  if (folds.every((fold, run) => fold.hidden.length === onSides[run]?.hidden.length)) {
    return null;
  }
  return showSideFolds.of(folds.map((fold) => fold.hidden.length));
}

export function pushFolds(
  field: StateField<readonly Fold[]>,
  sides: StateField<readonly Fold[]>,
  views: () => PaneViews,
): Extension {
  return EditorView.updateListener.of((update) => {
    const folds = update.state.field(field);
    if (folds === update.startState.field(field)) {
      return;
    }
    const { left, right } = views();
    const effect = sideFoldPush(left.state.field(sides), folds);
    if (effect !== null) {
      left.dispatch({ effects: effect });
      right.dispatch({ effects: effect });
    }
  });
}

export function sideReveals(
  sides: StateField<readonly Fold[]>,
  pane: "left" | "right",
  center: () => EditorView,
): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet) {
      return;
    }
    const selection = update.state.selection.main;
    const found = reveals(update.state.field(sides), pane, selection);
    if (found.length === 0) {
      return;
    }
    center().dispatch(showSpec(found));
    update.view.dispatch({ effects: EditorView.scrollIntoView(selection, { y: "center" }) });
  });
}
