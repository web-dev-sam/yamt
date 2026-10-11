import {
  ChangeSet,
  EditorSelection,
  Text,
  Transaction,
  type ChangeSpec,
  type EditorState,
  type StateEffect,
  type StateField,
  type TransactionSpec,
} from "@codemirror/state";

import type { Chunk } from "../../ipc";
import { setStatus, type ChunkSpan } from "./chunkField";
import type { Side } from "./side";
import { applyMode, canBulkApply, isSideOpen, statusAfterApply, statusAfterIgnore } from "./status";

export type ChunkAction = {
  readonly kind: "apply" | "ignore";
  readonly side: Side;
  readonly chunks: readonly Chunk[];
};

export type SideDocs = Readonly<Record<Side, Text>>;

export type ApplyTarget = {
  readonly state: EditorState;
  readonly field: StateField<readonly ChunkSpan[]>;
  readonly sides: SideDocs;
};

export type VisibleLines = { readonly first: number; readonly last: number };

export type Steps = readonly TransactionSpec[];

function sideLines(doc: Text, range: Chunk["local"] | Chunk["remote"]): string[] {
  return Array.from({ length: range.len }, (_, index) => doc.line(range.start + 1 + index).text);
}

function wholeLines(doc: Text, range: { from: number; to: number }, lines: string[]): ChangeSpec {
  const { from, to } = range;
  if (doc.lineAt(to).from === to) {
    return { from, to, insert: Text.of([...lines, ""]) };
  }
  if (lines.length === 0) {
    return { from: from === to ? from : Math.max(0, from - 1), to };
  }
  return { from, to, insert: Text.of(from === to ? ["", ...lines] : lines) };
}

function applyChange(target: ApplyTarget, span: ChunkSpan, side: Side): ChangeSpec {
  const lines = sideLines(target.sides[side], span.chunk[side]);
  const from = applyMode(span.status, side) === "replace" ? span.from : span.to;
  return wholeLines(target.state.doc, { from, to: span.to }, lines);
}

type ChainedAction = {
  readonly changes: ChangeSet;
  readonly effects: readonly StateEffect<unknown>[];
};

function chainedChanges(target: ApplyTarget, chunks: readonly Chunk[], side: Side): ChainedAction {
  let state = target.state;
  let changes = ChangeSet.empty(state.doc.length);
  const effects: StateEffect<unknown>[] = [];
  for (const chunk of chunks) {
    const span = state.field(target.field).find((current) => current.chunk.id === chunk.id);
    if (span === undefined) {
      throw new Error(`chunk ${chunk.id} is not in the chunk field`);
    }
    const effect = setStatus.of({
      id: chunk.id,
      status: statusAfterApply(chunk, span.status, side),
    });
    const click = state.update({
      changes: applyChange({ ...target, state }, span, side),
      effects: effect,
    });
    changes = changes.compose(click.changes);
    effects.push(effect);
    state = click.state;
  }
  return { changes, effects };
}

function chosenSpans(target: ApplyTarget, { side, chunks }: ChunkAction): ChunkSpan[] {
  const ids = new Set(chunks.map((chunk) => chunk.id));
  return target.state
    .field(target.field)
    .filter((span) => ids.has(span.chunk.id) && isSideOpen(span.chunk, span.status, side));
}

// History restores the selection from before the action's transaction, so the cursor moves in a
// transaction of its own (@codemirror/commands history: HistEvent.startSelection).
function moveCursor(pos: number): TransactionSpec {
  return {
    selection: EditorSelection.cursor(pos),
    annotations: Transaction.addToHistory.of(false),
  };
}

// A selection step after the action lands in the action's HistEvent.selectionsAfter: redo restores
// it instead of mapping the start selection with assoc 1, and later typing no longer joins the
// action's undo step (@codemirror/commands history: HistoryState.addChanges, pop).
function recordSelection(selection: EditorSelection): TransactionSpec {
  return { selection };
}

function bulkCursorTarget(state: EditorState, visible: VisibleLines): number | null {
  const line = state.doc.lineAt(state.selection.main.head).number;
  return line >= visible.first && line <= visible.last ? null : state.doc.line(visible.first).from;
}

export function dispatchSteps(dispatch: (spec: TransactionSpec) => void, steps: Steps): void {
  for (const spec of steps) {
    dispatch(spec);
  }
}

function chosenAction(
  target: ApplyTarget,
  spans: readonly ChunkSpan[],
  action: ChunkAction,
): ChainedAction {
  const { kind, side } = action;
  switch (kind) {
    case "apply":
      return chainedChanges(
        target,
        spans.map((span) => span.chunk),
        side,
      );
    case "ignore":
      return {
        changes: ChangeSet.empty(target.state.doc.length),
        effects: spans.map((span) =>
          setStatus.of({
            id: span.chunk.id,
            status: statusAfterIgnore(span.chunk, span.status, side),
          }),
        ),
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function actionSteps(target: ApplyTarget, action: ChunkAction): Steps {
  const spans = chosenSpans(target, action);
  const last = spans.at(-1);
  if (last === undefined) {
    return [];
  }
  const { changes, effects } = chosenAction(target, spans, action);
  return [
    moveCursor(last.from),
    { changes, effects, userEvent: `yamt.${action.kind}` },
    recordSelection(EditorSelection.single(last.from).map(changes)),
  ];
}

export function bulkApplySteps({
  target,
  side,
  visible,
}: {
  readonly target: ApplyTarget;
  readonly side: Side;
  readonly visible: VisibleLines;
}): Steps {
  const chunks = target.state
    .field(target.field)
    .filter((span) => canBulkApply(span.chunk, span.status, side))
    .map((span) => span.chunk);
  if (chunks.length === 0) {
    return [];
  }
  const { changes, effects } = chainedChanges(target, chunks, side);
  const action = { changes, effects, userEvent: "yamt.apply" };
  const cursor = bulkCursorTarget(target.state, visible);
  if (cursor === null) {
    return [action, recordSelection(target.state.selection.map(changes))];
  }
  return [moveCursor(cursor), action, recordSelection(EditorSelection.single(cursor).map(changes))];
}
