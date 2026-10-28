import {
  EditorState,
  StateEffect,
  StateField,
  Transaction,
  type ChangeDesc,
  type Extension,
  type Text,
  type TransactionSpec,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { toDocPos, type DocPos } from "./docPos";
import { displayed, MIN_HIDDEN_LINES, sameHidden } from "./foldRuns";
import type { Fold, FoldLevel, Hidden } from "./foldRuns";
import { hiddenLevels, hidingAll, leaveCollapsed, nextStep, reveals } from "./foldSteps";
import { sameCounts, shown, type FoldSteps, type ShowFolds } from "./foldSteps";
import type { Pane, PaneViews } from "./geometry";

export type FoldState = FoldSteps<Pane>;

export type FoldFields = {
  readonly runs: readonly Fold[];
  readonly center: StateField<FoldState>;
  readonly sides: StateField<readonly number[]>;
};

export const showFolds = StateEffect.define<ShowFolds>();
const setHiding = StateEffect.define<readonly number[]>();

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

export function paneFolds(fields: FoldFields, pane: Pane, state: EditorState): readonly Fold[] {
  if (pane === "center") {
    const { runs, hiding } = state.field(fields.center);
    return hiddenLevels(runs, hiding);
  }
  return hiddenLevels(fields.runs, state.field(fields.sides));
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

export function foldField(runs: readonly Fold[], collapsed: boolean): StateField<FoldState> {
  return StateField.define<FoldState>({
    create: () => ({ runs, hiding: hidingAll(runs, collapsed) }),
    update(folds, tr) {
      const mapped = tr.docChanged ? mapFolds(folds.runs, tr.changes, tr.state.doc) : folds.runs;
      let next = mapped === folds.runs ? folds : { ...folds, runs: mapped };
      for (const effect of tr.effects) {
        if (effect.is(showFolds)) {
          next = shown(next, effect.value);
        } else if (effect.is(setHiding) && !sameCounts(effect.value, next.hiding)) {
          next = { ...next, hiding: effect.value };
        }
      }
      if (tr.selection !== undefined) {
        const hidden = hiddenLevels(next.runs, next.hiding);
        for (const reveal of reveals(hidden, "center", tr.selection.main)) {
          next = shown(next, reveal);
        }
      }
      return next;
    },
  });
}

function sideFoldField(runs: readonly Fold[], collapsed: boolean): StateField<readonly number[]> {
  return StateField.define<readonly number[]>({
    create: () => hidingAll(runs, collapsed),
    update: (counts, tr) => tr.effects.findLast((effect) => effect.is(setHiding))?.value ?? counts,
  });
}

export function foldFields(runs: readonly Fold[], collapsed: boolean): FoldFields {
  return {
    runs,
    center: foldField(runs, collapsed),
    sides: sideFoldField(runs, collapsed),
  };
}

export function collapseSpec(
  field: StateField<FoldState>,
  state: EditorState,
  collapsed: boolean,
): TransactionSpec {
  const { runs } = state.field(field);
  const hiding = hidingAll(runs, collapsed);
  const spec = {
    effects: setHiding.of(hiding),
    annotations: Transaction.addToHistory.of(false),
  };
  const selection = leaveCollapsed(state.selection, { runs, hiding }, "center");
  return selection === null ? spec : { ...spec, selection };
}

function showSpec(shows: readonly ShowFolds[]): TransactionSpec {
  return {
    effects: shows.map((show) => showFolds.of(show)),
    annotations: Transaction.addToHistory.of(false),
  };
}

export function showNextStep(folds: FoldState, run: number): TransactionSpec {
  return showSpec([nextStep(folds, run)]);
}

function removesHidden(tr: Transaction, { from, to }: Hidden): boolean {
  let removes = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    removes ||= Math.max(fromA, from) < Math.min(toA, to);
  });
  return removes;
}

function deletedWaves(tr: Transaction, folds: FoldState): ShowFolds[] {
  if (!tr.isUserEvent("delete") || tr.startState.selection.ranges.some((range) => !range.empty)) {
    return [];
  }
  return hiddenLevels(folds.runs, folds.hiding).flatMap((fold, run) => {
    const hidden = displayed(fold, "center");
    return hidden !== null && removesHidden(tr, hidden) ? [nextStep(folds, run)] : [];
  });
}

export function waveDeletes(field: StateField<FoldState>): Extension {
  return EditorState.transactionFilter.of((tr) => {
    const steps = deletedWaves(tr, tr.startState.field(field));
    return steps.length === 0 ? tr : showSpec(steps);
  });
}

export function sideFoldPush(
  fields: FoldFields,
  pane: "left" | "right",
  side: EditorState,
  folds: FoldState,
): TransactionSpec | null {
  const before = side.field(fields.sides);
  const counts = folds.hiding;
  if (sameCounts(counts, before)) {
    return null;
  }
  const effects = setHiding.of(counts);
  if (counts.every((count, run) => count <= (before[run] ?? 0))) {
    return { effects };
  }
  const selection = leaveCollapsed(side.selection, { runs: fields.runs, hiding: counts }, pane);
  return selection === null ? { effects } : { effects, selection };
}

export function pushFolds(fields: FoldFields, views: () => PaneViews): Extension {
  return EditorView.updateListener.of((update) => {
    const folds = update.state.field(fields.center);
    if (folds.hiding === update.startState.field(fields.center).hiding) {
      return;
    }
    for (const pane of ["left", "right"] as const) {
      const view = views()[pane];
      const spec = sideFoldPush(fields, pane, view.state, folds);
      if (spec !== null) {
        view.dispatch(spec);
      }
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
